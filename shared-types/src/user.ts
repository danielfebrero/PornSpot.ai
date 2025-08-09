// User Authentication Types
import type { AuthProvider, SubscriptionStatus, ThumbnailUrls } from "./core";

export interface User {
  userId: string;
  email: string;
  username?: string; // Now required
  firstName?: string;
  lastName?: string;
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
