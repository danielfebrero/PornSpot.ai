// Import shared types directly to avoid barrel ("./index") circular dependencies
import type {
  Album,
  Media,
  User,
  Comment as SharedComment,
  UserLoginRequest,
  UserRegistrationRequest,
  UserProfileInsights,
  ThumbnailUrls,
} from "@/types/shared-types";
import type { UserInteraction } from "@/types/shared-types";

// Frontend-specific interaction request (with albumId and action for frontend usage)
export interface InteractionRequest {
  targetType: "album" | "media" | "comment";
  targetId: string;
  action: "add" | "remove";
  albumId?: string; // Required for media interactions
}

// Comment type with target enrichment for frontend display
export interface CommentWithTarget extends SharedComment {
  target: Media | Album; // Added for enriched comments from getUserComments API
}

// Frontend-specific authentication response types (with error field)
export interface UserLoginResponse {
  success: boolean;
  data?: ExtractedUserLoginResponse;
  error?: string;
  message?: string;
}

export interface ExtractedUserLoginResponse {
  user: User;
  sessionId: string;
}

export interface UserRegistrationResponse {
  success: boolean;
  data?: ExtractedUserRegistrationResponse;
  error?: string;
}

export interface ExtractedUserRegistrationResponse {
  userId: string;
  email: string;
  username: string;
  message: string;
}

export interface UserMeResponse {
  success: boolean;
  data?: ExtractedUserMeResponse;
  error?: string;
}

export interface ExtractedUserMeResponse {
  user: User;
}

// Email verification types (not in backend shared types)
export interface EmailVerificationRequest {
  token: string;
}

export interface EmailVerificationResponse {
  success: boolean;
  data?: ExtractedVerificationResponse;
  error?: string;
}

export interface ExtractedVerificationResponse {
  message: string;
  user?: User;
}

export interface ResendVerificationRequest {
  email: string;
}

export interface ResendVerificationResponse {
  success: boolean;
  data?: ExtractedResendVerificationResponse;
  error?: string;
}

export interface ExtractedResendVerificationResponse {
  message: string;
  email: string;
}

// Frontend-specific username availability (with data wrapper)
export interface UsernameAvailabilityResponse {
  available: boolean;
  message?: string;
}

// Frontend-specific authentication form types
export interface UserRegistrationFormData {
  email: string;
  password: string;
  confirmPassword: string;
  username: string;
}

export interface UserLoginFormData {
  email: string;
  password: string;
}

// Frontend-specific context types
export interface UserContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  initializing: boolean;
  isEmailVerified: boolean;
  emailVerificationRequired: boolean;
  login: (credentials: UserLoginRequest) => Promise<boolean>;
  register: (userData: UserRegistrationRequest) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  verifyEmail: (token: string) => Promise<boolean>;
  resendVerification: (email: string) => Promise<boolean>;
  clearError: () => void;
  clearUser: () => void;
  refetch: () => Promise<void>;
}

// Frontend-specific error types
export interface AuthError {
  message: string;
  code?: string;
  field?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

// Frontend-specific Google OAuth types
export interface GoogleOAuthState {
  state: string;
  codeVerifier: string;
}

// Frontend-specific Google OAuth response (with data wrapper)
export interface GoogleOAuthResponse {
  success: boolean;
  data?: ExtractedGoogleOAuthResponse;
  error?: string;
}

export interface ExtractedGoogleOAuthResponse {
  user: User;
  redirectUrl: string;
}

// Profile update types - frontend specific
export interface UserProfileUpdateRequest {
  username?: string;
  bio?: string;
  location?: string;
  website?: string;
  preferredLanguage?: string;
}

export interface UserProfileUpdateResponse {
  message: string;
  user?: User;
}

// Public profile types - frontend specific
export interface PublicUserProfile {
  userId: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  location?: string;
  website?: string;
  createdAt: string;
  avatarUrl?: string;
  avatarThumbnails?: ThumbnailUrls;
  profileInsights: UserProfileInsights;
}

export interface GetPublicProfileResponse {
  success: boolean;
  data?: {
    user: PublicUserProfile;
  };
  error?: string;
}

// Frontend-specific unified response types for user interactions
export interface UnifiedUserInteractionsResponse {
  interactions: UserInteraction[];
  pagination: {
    hasNext: boolean;
    cursor: string | null;
    limit: number;
  };
}

export interface UnifiedCommentsResponse {
  comments: CommentWithTarget[];
  pagination: {
    hasNext: boolean;
    cursor: string | null;
    limit: number;
  };
}

export interface UnifiedCommentsResponse {
  comments: CommentWithTarget[];
  pagination: {
    hasNext: boolean;
    cursor: string | null;
    limit: number;
  };
}

// (duplicate removed)

// User interaction stats - frontend specific
export interface UserInteractionStatsResponse {
  success: boolean;
  data?: {
    totalLikesReceived: number;
    totalBookmarksReceived: number;
  };
  error?: string;
}

// Re-export types from shared package that are used in frontend (that actually exist and don't conflict)
export type {
  User as BaseUser,
  UserSession,
  UserProfileInsights,
  UserInsightsResponse,
  InteractionResponse,
  InteractionCountsResponse,
  UserInteractionsResponse,
  ApiResponse,
  UsernameAvailabilityRequest,
  Comment,
} from "./shared-types";
