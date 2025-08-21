// User Authentication Types
import type { ThumbnailUrls } from "./core";
import type { UserPlan, PlanPermissions } from "./permissions";

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
  };
  profileInsights?: UserProfileInsights;
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
