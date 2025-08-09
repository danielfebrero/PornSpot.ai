// Core API and pagination types

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

export interface PaginatedApiResponse<T> {
  success: boolean;
  data: T[];
  pagination: PaginationMeta;
  error?: string;
}

// Legacy pagination interface - DEPRECATED
// Use PaginatedApiResponse from /shared/utils/pagination.ts instead
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Common types
export type EntityType = "Album" | "Media" | "User" | "AdminUser" | "UserSession" | "AdminSession" | "Comment" | "UserInteraction" | "AlbumMedia" | "EmailVerificationToken";

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
  [key: string]: string | number | boolean | null | undefined | string[] | { [key: string]: string | number };
}

// Specific metadata types for generated content
export interface GenerationMetadata extends Metadata {
  prompt?: string;
  negativePrompt?: string;
  creatorUsername?: string;
  creator?: string;
  artist?: string;
  loraModels?: string[];
  loraStrengths?: { [key: string]: string | number };
  bulkSiblings?: string[];
}