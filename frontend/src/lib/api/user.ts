import {
  UserLoginRequest,
  UserRegistrationRequest,
  UsernameAvailabilityRequest,
  UsernameAvailabilityResponse,
  UserProfileUpdateRequest,
  UserProfileUpdateResponse,
  GetPublicProfileResponse,
  PublicUserProfile,
  User,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error("NEXT_PUBLIC_API_URL is not set");
}
import { ApiUtil } from "../api-util";
import {
  ExtractedGoogleOAuthResponse,
  ExtractedResendVerificationResponse,
  ExtractedUserLoginResponse,
  ExtractedUserMeResponse,
  ExtractedUserRegistrationResponse,
  ExtractedVerificationResponse,
} from "@/types/user";

// User Authentication API Functions
export const userApi = {
  // User login
  login: async (
    credentials: UserLoginRequest
  ): Promise<ExtractedUserLoginResponse> => {
    const response = await ApiUtil.post<ExtractedUserLoginResponse>(
      "/user/login",
      credentials
    );
    return ApiUtil.extractData(response);
  },

  // Check username availability
  checkUsernameAvailability: async (
    request: UsernameAvailabilityRequest
  ): Promise<UsernameAvailabilityResponse> => {
    const response = await ApiUtil.post<UsernameAvailabilityResponse>(
      "/user/auth/check-username",
      request
    );
    return ApiUtil.extractData(response);
  },

  // User registration
  register: async (
    userData: UserRegistrationRequest
  ): Promise<ExtractedUserRegistrationResponse> => {
    const response = await ApiUtil.post<ExtractedUserRegistrationResponse>(
      "/user/register",
      userData
    );
    return ApiUtil.extractData(response);
  },

  // User logout
  logout: async (): Promise<void> => {
    await ApiUtil.post<void>("/user/logout");
  },

  // Get current user
  me: async (): Promise<ExtractedUserMeResponse> => {
    const response = await ApiUtil.get<ExtractedUserMeResponse>("/user/me");
    return ApiUtil.extractData(response);
  },

  // Verify email
  verifyEmail: async (
    token: string
  ): Promise<ExtractedVerificationResponse> => {
    const response = await ApiUtil.post<ExtractedVerificationResponse>(
      "/user/verify-email",
      { token }
    );
    return ApiUtil.extractData(response);
  },

  // Resend verification email
  resendVerification: async (
    email: string
  ): Promise<ExtractedResendVerificationResponse> => {
    const response = await ApiUtil.post<ExtractedResendVerificationResponse>(
      "/user/resend-verification",
      { email }
    );
    return ApiUtil.extractData(response);
  },

  // Google OAuth callback
  googleOAuthCallback: async (
    code: string,
    state?: string
  ): Promise<ExtractedGoogleOAuthResponse> => {
    const response = await ApiUtil.post<ExtractedGoogleOAuthResponse>(
      "/auth/oauth/callback",
      { code, state }
    );
    return ApiUtil.extractData(response);
  },

  // Update user profile
  updateProfile: async (
    profileData: UserProfileUpdateRequest
  ): Promise<UserProfileUpdateResponse> => {
    const response = await ApiUtil.put<UserProfileUpdateResponse>(
      "/user/profile/edit",
      profileData
    );
    return ApiUtil.extractData(response);
  },

  // Change password
  changePassword: async (passwordData: {
    currentPassword: string;
    newPassword: string;
  }): Promise<{ success: boolean; message: string }> => {
    const response = await ApiUtil.post<{ success: boolean; message: string }>(
      "/user/auth/change-password",
      passwordData
    );
    return ApiUtil.extractData(response);
  },

  // Delete account
  deleteAccount: async (): Promise<{ success: boolean; message: string }> => {
    const response = await ApiUtil.delete<{
      success: boolean;
      message: string;
    }>("/user/account/delete");
    return ApiUtil.extractData(response);
  },

  // Cancel subscription
  cancelSubscription: async (): Promise<{
    success: boolean;
    message: string;
  }> => {
    const response = await ApiUtil.post<{
      success: boolean;
      message: string;
    }>("/user/subscription/cancel");
    return ApiUtil.extractData(response);
  },

  // Update language preference
  updateLanguage: async (
    languageCode: string
  ): Promise<{
    success: boolean;
    message: string;
    user?: User;
  }> => {
    const response = await ApiUtil.put<{
      success: boolean;
      message: string;
      user?: User;
    }>("/user/profile/edit", { preferredLanguage: languageCode });
    return ApiUtil.extractData(response);
  },

  // Get public user profile by username
  getPublicProfile: async (username: string): Promise<PublicUserProfile> => {
    const response = await ApiUtil.get<GetPublicProfileResponse>(
      "/user/profile/get",
      { username }
    );
    const data = ApiUtil.extractData(response) as unknown as {
      user: PublicUserProfile;
    };
    return data.user;
  },

  // Upload avatar - request presigned URL
  uploadAvatar: async (
    filename: string,
    contentType: string
  ): Promise<{
    success: boolean;
    data: { uploadUrl: string; avatarKey: string };
  }> => {
    const response = await ApiUtil.post<{
      success: boolean;
      data: { uploadUrl: string; avatarKey: string };
    }>("/user/profile/avatar/upload", { filename, contentType });
    return ApiUtil.extractData(response);
  },

  // Generate JWT token for WebSocket authentication
  generateJwt: async (): Promise<{
    token: string;
    expiresIn: string;
    tokenType: string;
  }> => {
    const response = await ApiUtil.post<{
      token: string;
      expiresIn: string;
      tokenType: string;
    }>("/user/auth/generate-jwt");
    return ApiUtil.extractData(response);
  },
};
