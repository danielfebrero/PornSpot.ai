# User Authentication

This document provides a comprehensive overview of the user authentication and session management system for the PornSpot.ai application.

## Centralized Authentication Utility

### UserAuthUtil - Modern Authentication Pattern

The `UserAuthUtil` class (`backend/shared/utils/user-auth.ts`) provides a centralized, consistent way to handle user authentication across all Lambda functions. This utility replaces the repetitive pattern of manually checking authorizer context and falling back to session validation.

#### Key Features

- **Unified Authentication Flow**: Automatically handles authorizer context extraction and session validation fallback
- **Anonymous Access Support**: Configurable support for endpoints that allow anonymous access
- **Role Integration**: Optional user role fetching for permission-based access control
- **Consistent Error Handling**: Standardized error responses and logging
- **Type Safety**: Full TypeScript support with proper type guards

#### Usage Examples

```typescript
// Basic required authentication
const authResult = await UserAuthUtil.requireAuth(event);
if (UserAuthUtil.isErrorResponse(authResult)) {
  return authResult; // Return error response
}
const userId = authResult.userId!; // User ID is guaranteed to exist

// Authentication with role information
const authResult = await UserAuthUtil.requireAuth(event, { includeRole: true });
if (UserAuthUtil.isErrorResponse(authResult)) {
  return authResult;
}
const userId = authResult.userId!;
const userRole = authResult.userRole; // "admin", "moderator", or "user"

// Allow anonymous access (for public endpoints)
const authResult = await UserAuthUtil.allowAnonymous(event);
if (UserAuthUtil.isErrorResponse(authResult)) {
  return authResult; // Unlikely with allowAnonymous
}
const userId = authResult.userId; // Can be null for anonymous users

// Advanced configuration
const authResult = await UserAuthUtil.extractUserAuth(event, {
  allowAnonymous: true,
  includeRole: true,
});
```

#### Migration from Legacy Pattern

**Before (Legacy Pattern):**

```typescript
// Old repetitive pattern found throughout the codebase
let userId = event.requestContext.authorizer?.["userId"];

if (!userId) {
  const validation = await UserAuthMiddleware.validateSession(event);
  if (!validation.isValid || !validation.user) {
    return ResponseUtil.unauthorized(event, "No user session found");
  }
  userId = validation.user.userId;
}
```

**After (UserAuthUtil):**

```typescript
// New centralized pattern
const authResult = await UserAuthUtil.requireAuth(event);
if (UserAuthUtil.isErrorResponse(authResult)) {
  return authResult;
}
const userId = authResult.userId!;
```

#### Configuration Options

| Option           | Type    | Default | Description                                                                |
| ---------------- | ------- | ------- | -------------------------------------------------------------------------- |
| `allowAnonymous` | boolean | `false` | If true, returns null userId instead of error for unauthenticated requests |
| `includeRole`    | boolean | `false` | If true, fetches and includes user role information                        |

#### Return Types

The utility returns either a `UserAuthResult` object or an `APIGatewayProxyResult` error response:

```typescript
interface UserAuthResult {
  userId: string | null; // User ID or null if anonymous
  userRole?: string; // User role if includeRole is true
  userEmail?: string; // User email if available
  authSource: "authorizer" | "session" | "anonymous"; // How user was authenticated
}
```

#### Benefits

- **Reduced Code Duplication**: Eliminates 20+ lines of repetitive authentication code
- **Consistent Behavior**: Standardized authentication flow across all endpoints
- **Better Error Handling**: Centralized error messages and logging
- **Easier Testing**: Single utility to mock for authentication tests
- **Future-Proof**: Easy to extend with additional authentication features

## Authentication Flow

The user authentication system supports both email/password registration and Google OAuth.

```mermaid
graph TD
    A[Start] --> B{User chooses authentication method};
    B --> C[Email/Password];
    B --> D[Google OAuth];

    C --> E{User Registers};
    E --> F{Verification Email Sent};
    F --> G{User Verifies Email};
    G --> H{User Logs In};
    H --> I{Session Created};

    D --> J{User Signs in with Google};
    J --> K{Google Authenticates User};
    K --> L{Account Created/Linked};
    L --> I;

    I --> M[User is Authenticated];
```

## Email/Password Authentication

### 1. **Registration**

- **Endpoint**: `POST /user/auth/register`
- **Handler**: [`backend/functions/user/auth/register.ts`](../backend/functions/user/auth/register.ts)
- **Process**:
  1.  The user provides an email, password, and required username.
  2.  The system validates the email format, password strength, and username format.
  3.  The system checks that the username is unique across all users.
  4.  A new user is created in the database with `isEmailVerified` set to `false`.
  5.  A verification token is generated and sent to the user's email.

### 2. **Username Availability Check**

- **Endpoint**: `GET /user/auth/check-username?username={username}` or `POST /user/auth/check-username`
- **Handler**: [`backend/functions/user/auth/check-username.ts`](../backend/functions/user/auth/check-username.ts)
- **Process**:
  1.  The user provides a username to check for availability.
  2.  The system validates the username format (minimum 3 characters, alphanumeric with underscores/hyphens allowed).
  3.  The system checks if the username is already taken by querying the GSI3 index.
  4.  Returns availability status with appropriate message.
- **Usage**: This endpoint is designed for real-time username validation during registration with debouncing support.

### 3. **Email Verification**

- **Endpoint**: `GET /user/auth/verify-email` and `POST /user/auth/verify-email`
- **Handler**: [`backend/functions/user/auth/verify-email.ts`](../backend/functions/user/auth/verify-email.ts)
- **Process**:
  1.  The user clicks the verification link in the email (GET with token parameter) or enters the verification code in a form (POST with token in body).
  2.  The system validates the token.
  3.  If the token is valid, the user's `isEmailVerified` status is set to `true`.
  4.  The verification token is deleted from the database.
  5.  A new user session is created using the shared `SessionUtil`, automatically signing the user in.
  6.  The user's last login timestamp is updated.
  7.  A welcome email is sent to the user.
  8.  A session cookie is set in the response, completing the auto sign-in process.

### 4. **Login**

- **Endpoint**: `POST /user/auth/login`
- **Handler**: [`backend/functions/user/auth/login.ts`](../backend/functions/user/auth/login.ts)
- **Process**:
  1.  The user provides their email and password.
  2.  The system checks if the user exists and if the email is verified.
  3.  The provided password is compared with the hashed password in the database.
  4.  If the credentials are valid, a new session is created and a session cookie is returned.

## Google OAuth Authentication

### 1. **OAuth Flow**

- **Endpoint**: `GET /user/auth/oauth/google/callback`
- **Handler**: [`backend/functions/user/auth/oauth-google.ts`](../backend/functions/user/auth/oauth-google.ts)
- **Process**:
  1. The user is redirected to Google's OAuth consent screen.
  2. After user grants permission, Google redirects back with an authorization code.
  3. The system exchanges the code for an access token and retrieves user information.
  4. If the user's email exists in the system, the Google account is linked to the existing user.
  5. If the user is new, a new account is created with Google OAuth provider.
  6. **Automatic Username Generation**: OAuth users receive a unique username in the format `{adjective}-{noun}-{number}` (e.g., `brilliant-eagle-042`).
  7. A session is created and the user is authenticated.

### 2. **Username Generation for OAuth Users**

OAuth users don't choose their username during registration. Instead, the system automatically generates a unique username using:

- **Format**: `{adjective}-{noun}-{number}`
- **Components**:
  - 500 predefined adjectives (e.g., "brilliant", "creative", "amazing")
  - 500 predefined nouns (e.g., "eagle", "mountain", "galaxy")
  - Numbers 001-999 (zero-padded to 3 digits)
- **Examples**: `brilliant-eagle-042`, `creative-mountain-158`, `amazing-galaxy-999`

#### Username Repair

For existing OAuth users who have basic usernames (e.g., email-based), the system automatically repairs their username to the new format when they log in:

- **Trigger**: Automatic on OAuth login if username doesn't match new format
- **Process**:
  1. System detects old/invalid username format
  2. Generates new username using the adjective-noun-number format
  3. Updates user record with new username
  4. Logs the repair action for monitoring

#### Implementation

The username generation is handled by the `UsernameGenerator` utility:

```typescript
// Generate a new random username
const username = await UsernameGenerator.generateUniqueUsername();

// Generate username preferring email base, fallback to random
const username = await UsernameGenerator.generateUsernameFromEmail(email);

// Repair existing user's username if needed
const username = await OAuthUserUtil.repairUsernameIfNeeded(user);
```

### 2. **Environment Variables**

The Google OAuth integration requires the following environment variables:

- `GOOGLE_CLIENT_ID`: Your Google application's client ID.
- `GOOGLE_CLIENT_SECRET`: Your Google application's client secret (should be stored securely, e.g., in AWS Parameter Store).
- `FRONTEND_BASE_URL`: The base URL of your frontend application.

## Session Management

### Shared Session Utility

- **Utility**: [`backend/shared/utils/session.ts`](../backend/shared/utils/session.ts)
- **Purpose**: Centralizes session creation logic to avoid code duplication across authentication handlers
- **Usage**: Used by login, email verification, and OAuth authentication flows
- **Features**:
  - Creates session entity with proper expiration (30 days)
  - Updates user's last login timestamp
  - Generates secure session cookie
  - Returns consistent response format
  - Provides both standalone session creation and complete API response generation

### Session Creation

- A new session is created upon successful login, email verification, or OAuth authentication using the shared `SessionUtil`.
- A session is stored as a `UserSessionEntity` in the DynamoDB table.
- A secure, HTTP-only session cookie is set in the user's browser. The session duration is 30 days.

### Session Validation

- **Authorizer**: [`backend/functions/user/auth/authorizer.ts`](../backend/functions/user/auth/authorizer.ts)
- **Process**:
  1.  For each request to a protected endpoint, a Lambda authorizer is invoked.
  2.  The authorizer checks for the session cookie in the request headers.
  3.  The session ID is extracted from the cookie and used to retrieve the session from the database.
  4.  If the session is valid and not expired, the authorizer generates an IAM policy that allows the request to proceed.
  5.  The authorizer also passes user context (e.g., `userId`, `email`) to the downstream Lambda function.

### WebSocket Authentication

WebSocket connections use a different authentication approach due to browser limitations with cookie headers:

**Authentication Flow:**

1. **Frontend**: Extracts `user_session` cookie value using JavaScript
2. **Connection**: Includes session token as query parameter in WebSocket URL
3. **Backend**: Validates session token using existing `UserAuthMiddleware`
4. **Storage**: Stores user information in connection entity for message routing

**Implementation Details:**

```typescript
// Frontend: Extract session cookie
const getSessionCookie = () => {
  const cookies = document.cookie.split(";");
  const userSessionCookie = cookies.find((cookie) =>
    cookie.trim().startsWith("user_session=")
  );
  return userSessionCookie ? userSessionCookie.split("=")[1] : null;
};

// Include in WebSocket URL
const sessionToken = getSessionCookie();
const wsUrl = sessionToken
  ? `wss://websocket-url?sessionToken=${encodeURIComponent(sessionToken)}`
  : `wss://websocket-url`;
```

**Backend Processing:**

- **Priority Order**: Session token in query parameters takes precedence over cookie headers
- **Validation**: Uses existing `UserAuthMiddleware.validateSession()` with modified event object
- **Fallback**: Graceful degradation to cookie-based auth if no session token provided
- **Anonymous Support**: Invalid/missing authentication results in anonymous connection
- **Security**: Session tokens are logged in sanitized form for debugging

**Connection Entity Storage:**

```typescript
interface ConnectionEntity {
  PK: string; // CONNECTION#{connectionId}
  SK: string; // METADATA
  GSI1PK: string; // WEBSOCKET_CONNECTIONS
  GSI1SK: string; // {userId}#{connectionId} or ANONYMOUS#{connectionId}
  connectionId: string;
  userId?: string; // Present for authenticated connections
  connectedAt: string;
  lastActivity: string;
  ttl: number; // 24-hour automatic cleanup
}
```

**Security Considerations:**

- Session tokens transmitted as query parameters during handshake only
- Tokens validated against same DynamoDB session store as HTTP requests
- Failed authentication gracefully degrades to anonymous connection
- Connection cleanup prevents stale authentication state
- URLs with tokens are sanitized in client-side logging

### Authentication Redirects

The application supports automatic redirect functionality for unauthenticated users:

- **Login Redirects**: When an unauthenticated user attempts to access protected features (like, bookmark, add to album), they are automatically redirected to the login page with a `returnTo` parameter preserving their current location.
- **Post-Login Redirect**: After successful authentication, users are automatically redirected back to their original location using the `returnTo` parameter.
- **Implementation**:
  - Frontend components use the `useAuthRedirect` hook to handle redirects
  - Login form processes the `returnTo` query parameter for post-login navigation
  - Protected features in `ContentCard`, `LikeButton`, and `BookmarkButton` components automatically redirect unauthenticated users

### Protected Pages

The following pages require user authentication:

- **User Profiles**: Both own profile (`/user/profile`) and public profiles (`/profile/[username]`) require authentication. Unauthenticated users see the message "You must be logged in to view this profile."
- **Album Management**: Creating, editing, and managing albums requires authentication
- **Media Upload**: Uploading and managing media content requires authentication
- **User Interactions**: Liking, bookmarking, and commenting require authentication

### Session Expiration and Cleanup

- Sessions expire after 30 days of inactivity.
- The `cleanupExpiredUserSessions` function in [`backend/shared/utils/dynamodb.ts`](../backend/shared/utils/dynamodb.ts) is responsible for deleting expired sessions from the database. This is typically run as a scheduled task.

## Centralized Authentication Utility

For a consistent and streamlined approach to handling user authentication across all Lambda functions, see the [User Authentication Utility Guide](USER_AUTH_UTILITY.md). This utility replaces the repetitive authentication pattern with a centralized, type-safe solution.

### Quick Example

```typescript
import { UserAuthUtil } from "@shared/utils/user-auth";

export const handler = async (event: APIGatewayProxyEvent) => {
  // Extract user authentication using centralized utility
  const authResult = await UserAuthUtil.requireAuth(event);

  // Handle error response from authentication
  if (UserAuthUtil.isErrorResponse(authResult)) {
    return authResult;
  }

  const userId = authResult.userId!;
  console.log("✅ Authenticated user:", userId);

  // Your endpoint logic here...
};
```

## Security Considerations

- **Password Hashing**: Passwords are hashed using `bcrypt` with a salt.
- **CSRF Protection**: The Google OAuth flow uses a `state` parameter to protect against Cross-Site Request Forgery (CSRF) attacks.
- **Secure Cookies**: Session cookies are configured as HTTP-only, secure, and `SameSite=Strict`.
- **Timing Attacks**: The login endpoint includes a delay to prevent timing attacks when a user does not exist.
- **Email Enumeration Protection**: The resend verification endpoint always returns the same response regardless of whether the email exists, account status, or verification state to prevent email enumeration attacks.
- **Enhanced Email Verification**: Verification emails include both clickable links and copy-pasteable tokens for improved user experience and reliability.
