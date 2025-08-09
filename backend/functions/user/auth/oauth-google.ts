import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import { ResponseUtil } from "@shared/utils/response";
import { OAuthUserUtil } from "@shared/utils/oauth-user";
import { ParameterStoreService } from "@shared/utils/parameters";
import { SessionUtil } from "@shared/utils/session";
import { GoogleTokenResponse, GoogleOAuthUserInfo } from "@shared";
import { ValidationUtil } from "@shared/utils/validation";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";

// Google OAuth configuration from environment variables
const GOOGLE_CLIENT_ID = process.env["GOOGLE_CLIENT_ID"];

// Validate required environment variables (GOOGLE_CLIENT_SECRET will be validated in handler)
if (!GOOGLE_CLIENT_ID) {
  throw new Error("Missing GOOGLE_CLIENT_ID environment variable");
}

/**
 * Google OAuth callback handler
 * Handles the OAuth flow after user grants permission in Google
 */
const handleOAuthCallback = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("Google OAuth callback handler started");
  console.log("Query parameters:", event.queryStringParameters);

  // Fetch Google client secret and frontend URL from Parameter Store
  const [GOOGLE_CLIENT_SECRET, frontendUrl] = await Promise.all([
    ParameterStoreService.getGoogleClientSecret(),
    ParameterStoreService.getFrontendUrl(),
  ]);

  // Use frontend URL for redirect URI (matching what was used to initiate OAuth)
  const redirectUri = `${frontendUrl}/auth/oauth/callback`;
  console.log("Using redirect URI:", redirectUri);

  const oauth2Client = new OAuth2Client(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    redirectUri
  );

  // Parse and validate request body
  const requestBody = JSON.parse(event.body!);

  // Extract OAuth parameters from request body
  const code = requestBody.code;
  const state = requestBody.state;
  const error = requestBody.error;

  // Handle OAuth errors from Google
  if (error) {
    console.error("OAuth error from Google:", error);
    throw new Error(
      error === "access_denied"
        ? "User cancelled Google authentication"
        : "OAuth authentication failed"
    );
  }

  // Validate required parameters using centralized validation
  const authCode = ValidationUtil.validateRequiredString(code, "Authorization code");
  const stateParam = ValidationUtil.validateRequiredString(state, "State parameter");

  console.log("Exchanging authorization code for tokens");

  // Exchange authorization code for tokens
  const { tokens } = await oauth2Client.getToken(authCode);

  if (!tokens.access_token || !tokens.id_token) {
    throw new Error("Missing required tokens in Google response");
  }

  const tokenResponse: GoogleTokenResponse = {
    access_token: tokens.access_token,
    id_token: tokens.id_token,
    expires_in: tokens.expiry_date
      ? Math.floor((tokens.expiry_date - Date.now()) / 1000)
      : 3600,
    token_type: tokens.token_type || "Bearer",
    scope: tokens.scope || "",
    ...(tokens.refresh_token && { refresh_token: tokens.refresh_token }),
  };

  console.log("Verifying Google ID token");

  // Verify and decode the ID token
  const ticket = await oauth2Client.verifyIdToken({
    idToken: tokenResponse.id_token,
    audience: GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email) {
    throw new Error("Invalid Google ID token payload");
  }

  // Verify email is verified in Google
  if (!payload.email_verified) {
    throw new Error("Google email not verified");
  }

  const googleUserInfo: GoogleOAuthUserInfo = {
    googleId: payload.sub,
    email: payload.email,
    ...(payload.picture && { profilePicture: payload.picture }),
  };

  console.log("Google user info verified:", {
    googleId: googleUserInfo.googleId,
    email: googleUserInfo.email,
  });

  // Create or link Google user account
  const result = await OAuthUserUtil.createOrLinkGoogleUser(
    googleUserInfo.googleId,
    googleUserInfo.email
  );

  const { userId, isNewUser } = result;

  console.log("User account processed:", { userId, isNewUser });

  // Create user session with auto sign-in (OAuth user's last login is updated in updateLastLogin)
  const sessionResult = await SessionUtil.createUserSession({
    userId,
    userEmail: googleUserInfo.email,
    updateLastLogin: true,
  });

  console.log("OAuth session created successfully:", sessionResult.sessionId);

  // Return success response with user data and redirect URL
  const response = ResponseUtil.success(event, {
    user: {
      userId,
      email: googleUserInfo.email,
      isEmailVerified: true,
    },
    redirectUrl: `/auth/success${isNewUser ? "?new_user=true" : ""}`,
  });

  response.headers = {
    ...response.headers,
    "Set-Cookie": sessionResult.sessionCookie,
  };

  console.log("OAuth flow completed successfully");

  return response;
};

// Export the wrapped handler using shared utilities
export const handler = LambdaHandlerUtil.withoutAuth(handleOAuthCallback, {
  requireBody: true,
});

/**
 * Helper function to get detailed user profile from Google People API
 * This is optional and can provide additional profile information
 */
export const getGoogleUserProfile = async (
  accessToken: string
): Promise<any> => {
  try {
    const people = google.people({ version: "v1" });

    const response = await people.people.get({
      resourceName: "people/me",
      personFields: "names,emailAddresses,photos,phoneNumbers,addresses",
      access_token: accessToken,
    });

    return response.data;
  } catch (error) {
    console.error("Failed to fetch Google user profile:", error);
    return null;
  }
};

/**
 * Helper function to validate Google access token
 */
export const validateGoogleAccessToken = async (
  accessToken: string
): Promise<boolean> => {
  try {
    const response = await fetch(
      `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`
    );

    if (!response.ok) {
      return false;
    }

    const tokenInfo = await response.json();

    // Verify the token is for our application
    return tokenInfo.audience === GOOGLE_CLIENT_ID;
  } catch (error) {
    console.error("Failed to validate Google access token:", error);
    return false;
  }
};
