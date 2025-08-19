import type { Album, ApiResponse, Media } from "@/types/shared-types";
export type { Album, ApiResponse, Media } from "@/types/shared-types";

// Re-export shared types from the shared types package
export * from "@/types/shared-types";
// Frontend-specific pagination types that extend the base types
export interface UnifiedPaginationMeta {
  hasNext: boolean; // Whether more pages exist
  cursor: string | null; // Base64-encoded cursor for next page
  limit: number; // Actual limit used
}

// Base unified paginated response type
export interface UnifiedPaginatedResponse<T = any> extends ApiResponse {
  data: {
    pagination: UnifiedPaginationMeta;
  } & Record<string, T[] | UnifiedPaginationMeta>;
}

// Specific unified response types for type safety
export interface UnifiedAlbumsResponse {
  albums: Album[];
  pagination: UnifiedPaginationMeta;
}

export interface UnifiedMediaResponse {
  media: Media[];
  pagination: UnifiedPaginationMeta;
}

// Frontend-specific thumbnail system types
export type ThumbnailSize =
  | "cover"
  | "small"
  | "medium"
  | "large"
  | "xlarge"
  | "originalSize";

export type ThumbnailContext =
  | "cover-selector"
  | "create-album"
  | "discover"
  | "albums"
  | "admin"
  | "default";

// Frontend-specific permission and plan types
export * from "./permissions";

// Re-export frontend-specific user types
export type {
  CommentWithTarget,
  InteractionRequest,
  UserInteraction,
  UserRegistrationFormData,
  UserLoginFormData,
  UserLoginResponse,
  UserContextType,
  AuthError,
  ValidationError,
  GoogleOAuthState,
  GoogleOAuthResponse,
  UsernameAvailabilityResponse,
  UserWithPlanInfo,
  UserProfileUpdateRequest,
  UserProfileUpdateResponse,
  PublicUserProfile,
  GetPublicProfileResponse,
  UnifiedUserInteractionsResponse,
  UnifiedCommentsResponse,
  UserInteractionStatsResponse,
  UserRegistrationResponse,
  UserMeResponse,
  EmailVerificationRequest,
  EmailVerificationResponse,
  ResendVerificationRequest,
  ResendVerificationResponse,
} from "./user";

// Re-export shared types that are needed directly
// (explicit re-exports removed; already provided by export * above)

export interface InfiniteMediaQueryData {
  pages: UnifiedMediaResponse[];
  pageParams: unknown[];
}
