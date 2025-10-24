/**
 * @fileoverview User Shared Types
 * @description Types for users, sessions, plans, and authentication.
 * @notes
 * - User, UserEntity for database.
 * - UserPlan enum.
 * - UserPlanInfo, UserUsageStats interfaces.
 * - EnhancedUser with plan, usage, insights.
 * - LoginRequest, LoginResponse.
 * - CreateUserRequest, UpdateUserRequest for API.
 * - DisableUserRequest, EnableUserRequest.
 * - UserSessionEntity for sessions.
 * - EmailVerificationTokenEntity, PasswordResetTokenEntity for auth.
 * - AuthProvider, SubscriptionStatus enums.
 */
import type { ThumbnailUrls } from "./core";
import type { UserPlan, PlanPermissions } from "./permissions";

// Email notification preferences
export type EmailPreferenceMode = "intelligently" | "always" | "never";

export interface EmailPreferences {
  pscBalance?: EmailPreferenceMode;
  unreadNotifications?: EmailPreferenceMode;
  newFollowers?: EmailPreferenceMode;
  communications?: EmailPreferenceMode;
}

export interface User {
  userId: string;
  email: string;
  username?: string; // Now required
  firstName?: string;
  lastName?: string;
  bio?: string;
  location?: string;
  website?: string;
  createdAt: string;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLoginAt?: string;
  lastActive?: string; // Last time user was seen active (updated on each request)
  googleId?: string; // For future Google OAuth integration
  preferredLanguage?: string; // User's preferred language (ISO 639-1 code: en, fr, de, etc.)

  // Avatar information
  avatarUrl?: string; // Original avatar image URL
  avatarThumbnails?: ThumbnailUrls;

  role: string; // 'user', 'admin', 'moderator'
  planInfo: {
    plan: UserPlan; // 'free', 'starter', 'unlimited', 'pro'
    isActive: boolean;
    subscriptionId?: string;
    subscriptionStatus?: "active" | "canceled" | "expired";
    planStartDate?: string;
    planEndDate?: string;
    permissions?: PlanPermissions;
  };
  usageStats: {
    imagesGeneratedThisMonth: number;
    imagesGeneratedToday: number;
    storageUsedGB?: number;
    lastGenerationAt?: string;
    bonusGenerationCredits?: number;
  };
  // Email notification preferences
  emailPreferences?: EmailPreferences;
  profileInsights?: UserProfileInsights;
  followerCount: number;
  // Image-to-video generation credits (in seconds)
  i2vCreditsSecondsPurchased?: number; // credits user purchased
  i2vCreditsSecondsFromPlan?: number; // credits granted by current plan
}

export interface PublicUserProfile {
  userId: string;
  username?: string;
  createdAt: string;
  lastActive?: string; // Last time user was seen active (updated on each request)
  isActive: boolean;
  isEmailVerified: boolean;
  lastLoginAt?: string;
  bio?: string;
  location?: string;
  website?: string;

  // Avatar information
  avatarUrl?: string;
  avatarThumbnails?: {
    originalSize?: string;
    small?: string;
    medium?: string;
    large?: string;
  };

  // Profile insights
  profileInsights?: UserProfileInsights;

  planInfo: {
    plan: UserPlan;
  };

  isFollowed: boolean;
  isFollowing: boolean;
  followerCount: number;
}

export interface MinimalUser {
  userId?: string;
  username?: string;
  avatarUrl?: string;
  avatarThumbnails?: {
    originalSize?: string;
    small?: string;
    medium?: string;
    large?: string;
  };
}

export interface UserSession {
  sessionId: string;
  userId: string;
  userEmail: string;
  createdAt: string;
  expiresAt: string;
  lastAccessedAt: string;
}

export interface UserRegistrationRequest {
  email: string;
  password: string;
  username: string; // Now required
}

export interface UserLoginRequest {
  email: string;
  password: string;
}

export interface UserLoginResponse {
  success: boolean;
  user: User;
  sessionId: string;
}

export interface UserProfileUpdateRequest {
  username?: string;
  bio?: string;
  location?: string;
  website?: string;
  preferredLanguage?: string;
  emailPreferences?: EmailPreferences;
}

export interface UserProfileUpdateResponse {
  message: string;
  user?: {
    userId: string;
    email: string;
    username?: string;
    bio?: string;
    location?: string;
    website?: string;
    preferredLanguage?: string;
    emailPreferences?: EmailPreferences;
    createdAt: string;
    lastLoginAt?: string;
    avatarUrl?: string;
    avatarThumbnails?: ThumbnailUrls;
  };
}

export interface CancelSubscriptionResponse {
  message: string;
}

export interface UserSessionValidationResult {
  isValid: boolean;
  user?: User;
  session?: UserSession;
}

export interface UsernameAvailabilityRequest {
  username: string;
}

export interface UsernameAvailabilityResponse {
  success: boolean;
  available: boolean;
  message?: string;
  error?: string;
}

// Google OAuth Types
export interface GoogleOAuthUserInfo {
  googleId: string;
  email: string;
  profilePicture?: string;
}

export interface GoogleOAuthRequest {
  code: string;
  state?: string;
}

export interface GoogleOAuthResponse {
  success: boolean;
  user?: User;
  sessionId?: string;
  redirectUrl: string;
  error?: string;
}

export interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  refresh_token?: string;
}

export interface GoogleTokenInfoResponse {
  audience: string;
  user_id: string;
  scope: string;
  expires_in: number;
  access_type?: string;
}

// User profile insights/metrics types
export interface UserProfileInsights {
  totalLikesReceived: number;
  totalBookmarksReceived: number;
  totalMediaViews: number;
  totalProfileViews: number;
  totalGeneratedMedias: number;
  totalAlbums: number;
  lastUpdated: string;
}

export interface UserInsightsResponse {
  success: boolean;
  data?: UserProfileInsights;
  error?: string;
}

// Password reset types
export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  message: string;
  user?: User;
  sessionId?: string;
}
