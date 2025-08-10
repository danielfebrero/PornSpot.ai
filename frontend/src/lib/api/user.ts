import {
  UserLoginRequest,
  UserRegistrationRequest,
  UserLoginResponse,
  UserRegistrationResponse,
  UserMeResponse,
  EmailVerificationResponse,
  ResendVerificationResponse,
  GoogleOAuthResponse,
  UsernameAvailabilityRequest,
  UsernameAvailabilityResponse,
  UserProfileUpdateRequest,
  UserProfileUpdateResponse,
  GetPublicProfileResponse,
} from "@/types";
import { User as BaseUser } from "shared-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error("NEXT_PUBLIC_API_URL is not set");
}
import { ApiUtil } from "../api-util";

// User Authentication API Functions
export const userApi = {
  // User login
  login: async (credentials: UserLoginRequest): Promise<UserLoginResponse> => {
    const response = await ApiUtil.post<UserLoginResponse>("/user/login", credentials);
    return ApiUtil.extractData(response);
  },

  // Check username availability
  checkUsernameAvailability: async (
    request: UsernameAvailabilityRequest
  ): Promise<UsernameAvailabilityResponse> => {
    const response = await ApiUtil.post<UsernameAvailabilityResponse>("/user/auth/check-username", request);
    return ApiUtil.extractData(response);
  },

  // User registration
  register: async (
    userData: UserRegistrationRequest
  ): Promise<UserRegistrationResponse> => {
    const response = await ApiUtil.post<UserRegistrationResponse>("/user/register", userData);
    return ApiUtil.extractData(response);
  },

  // User logout
  logout: async (): Promise<void> => {
    await ApiUtil.post<void>("/user/logout");
  },

  // Get current user
  me: async (): Promise<UserMeResponse> => {
    const response = await ApiUtil.get<UserMeResponse>("/user/me");
    return ApiUtil.extractData(response);
  },

  // Verify email
  verifyEmail: async (token: string): Promise<EmailVerificationResponse> => {
    const response = await ApiUtil.post<EmailVerificationResponse>("/user/verify-email", { token });
    return ApiUtil.extractData(response);
  },

  // Resend verification email
  resendVerification: async (
    email: string
  ): Promise<ResendVerificationResponse> => {
    const response = await ApiUtil.post<ResendVerificationResponse>("/user/resend-verification", { email });
    return ApiUtil.extractData(response);
  },

  // Google OAuth callback
  googleOAuthCallback: async (
    code: string,
    state?: string
  ): Promise<GoogleOAuthResponse> => {
    const response = await ApiUtil.post<GoogleOAuthResponse>("/auth/oauth/callback", { code, state });
    return ApiUtil.extractData(response);
  },

  // Update user profile
  updateProfile: async (
    profileData: UserProfileUpdateRequest
  ): Promise<UserProfileUpdateResponse> => {
    const response = await ApiUtil.put<UserProfileUpdateResponse>("/user/profile/edit", profileData);
    return ApiUtil.extractData(response);
  },

  // Change password
  changePassword: async (passwordData: {
    currentPassword: string;
    newPassword: string;
  }): Promise<{ success: boolean; message: string }> => {
    const response = await ApiUtil.post<{ success: boolean; message: string }>("/user/auth/change-password", passwordData);
    return ApiUtil.extractData(response);
  },

  // Delete account
  deleteAccount: async (): Promise<{ success: boolean; message: string }> => {
    const response = await ApiUtil.delete<{ success: boolean; message: string }>("/user/account/delete");
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
    user?: BaseUser;
  }> => {
    const response = await ApiUtil.put<{
      success: boolean;
      message: string;
      user?: BaseUser;
    }>("/user/profile/edit", { preferredLanguage: languageCode });
    return ApiUtil.extractData(response);
  },

  // Get public user profile by username
  getPublicProfile: async (
    username: string
  ): Promise<GetPublicProfileResponse> => {
    const response = await ApiUtil.get<GetPublicProfileResponse>("/user/profile/get", { username });
    return ApiUtil.extractData(response);
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
};
