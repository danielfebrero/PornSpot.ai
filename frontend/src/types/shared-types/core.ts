// Core API and pagination types

// Note: deprecated top-level PaginatedApiResponse<T> removed. Use
// ApiKeyedPaginatedResponse<K, T> or ApiPaginatedResponse<T> instead.

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Standard pagination interfaces - use these for new implementations
export interface PaginationRequest {
  cursor?: string;
  limit?: number;
}

export interface PaginationMeta {
  hasNext: boolean;
  cursor: string | null;
  limit: number;
}

// Unified paginated response helpers
// 1) For endpoints returning the array under a domain key (e.g., interactions, comments)
export type KeyedPaginatedPayload<K extends string, T> = {
  [P in K]: T[];
} & { pagination: PaginationMeta };

export type ApiKeyedPaginatedResponse<K extends string, T> = ApiResponse<
  KeyedPaginatedPayload<K, T>
>;

// 2) For endpoints returning the array under a generic "data" key
export interface PaginatedListPayload<T> {
  data: T[];
  pagination: PaginationMeta;
}

export type ApiPaginatedResponse<T> = ApiResponse<PaginatedListPayload<T>>;

// Note: Avoid top-level array + pagination shapes; prefer keyed payloads above.

// Common types
export type EntityType =
  | "Album"
  | "Media"
  | "User"
  | "AdminUser"
  | "UserSession"
  | "AdminSession"
  | "Comment"
  | "UserInteraction"
  | "AlbumMedia"
  | "AlbumTag"
  | "EmailVerificationToken"
  | "PasswordResetToken";

export type CreatorType = "user" | "admin";

export type TargetType = "album" | "media" | "comment";

export type CommentTargetType = "album" | "media";

export type InteractionType = "like" | "bookmark";

export type MediaStatus = "pending" | "uploaded" | "failed";

export type AuthProvider = "email" | "google";

export type SubscriptionStatus = "active" | "canceled" | "expired";

// Thumbnail types
export interface ThumbnailUrls {
  cover?: string;
  small?: string;
  medium?: string;
  large?: string;
  xlarge?: string;
  originalSize?: string;
  [size: string]: string | undefined;
}

// Generic metadata type
export interface Metadata {
  [key: string]:
    | string
    | number
    | boolean
    | null
    | undefined
    | string[]
    | Record<string, { mode: "auto" | "manual"; value: number }>
    | { [key: string]: string | number };
}

// View count types for content analytics
export interface ViewCountTarget {
  targetType: "album" | "media";
  targetId: string;
}

export interface ViewCountItem {
  targetType: "album" | "media";
  targetId: string;
  viewCount: number;
}

export interface ViewCountResponse {
  viewCounts: ViewCountItem[];
}

// View tracking types (includes profile views)
export interface ViewTrackingRequest {
  targetType: "album" | "media" | "profile";
  targetId: string;
}
