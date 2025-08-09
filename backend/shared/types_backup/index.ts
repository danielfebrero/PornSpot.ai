export interface Album {
  id: string;
  title: string;
  type: "album";
  tags?: string[] | undefined;
  coverImageUrl?: string | undefined;
  thumbnailUrls?:
    | {
        cover?: string;
        small?: string;
        medium?: string;
        large?: string;
        xlarge?: string;
        originalSize?: string;
      }
    | undefined;
  createdAt: string;
  updatedAt: string;
  mediaCount: number;
  isPublic: boolean;
  likeCount?: number;
  bookmarkCount?: number;
  viewCount?: number;
  commentCount?: number;
  metadata?: Record<string, any> | undefined;
  // User tracking fields
  createdBy?: string | undefined; // userId or adminId who created this album
  createdByType?: "user" | "admin" | undefined; // type of creator
  comments?: Comment[] | undefined; // Include comments directly in Album
}

export interface Media {
  id: string;
  filename: string;
  originalFilename: string;
  type: "media";
  mimeType: string;
  size: number;
  width?: number | undefined;
  height?: number | undefined;
  url: string;
  thumbnailUrl?: string | undefined;
  thumbnailUrls?:
    | {
        cover?: string;
        small?: string;
        medium?: string;
        large?: string;
        xlarge?: string;
        originalSize?: string;
      }
    | undefined;
  status?: "pending" | "uploaded" | "failed" | undefined;
  createdAt: string;
  updatedAt: string;
  likeCount?: number;
  bookmarkCount?: number;
  viewCount?: number;
  commentCount?: number;
  metadata?: Record<string, any> | undefined;
  // User tracking fields
  createdBy?: string | undefined;
  createdByType?: "user" | "admin" | undefined;
  // Album relationships (populated when needed)
  albums?: Album[] | undefined; // array of album objects this media belongs to
  comments?: Comment[] | undefined; // Include comments directly in Media
}

export interface CreateAlbumRequest {
  title: string;
  tags?: string[] | undefined;
  isPublic?: boolean | undefined;
  mediaIds?: string[] | undefined; // For user album creation with selected media
  coverImageId?: string | undefined; // Media ID to use as cover image
}

export interface UpdateAlbumRequest {
  title?: string | undefined;
  tags?: string[] | undefined;
  isPublic?: boolean | undefined;
  coverImageUrl?: string | undefined;
}

export interface BulkDeleteAlbumsRequest {
  albumIds: string[];
}

export interface AddMediaToAlbumRequest {
  mediaId?: string; // For single media addition
  mediaIds?: string[]; // For bulk media addition
}

export interface RemoveMediaFromAlbumRequest {
  mediaId?: string; // For single media removal
  mediaIds?: string[]; // For bulk media removal
}

export interface UploadMediaRequest {
  filename: string;
  mimeType: string;
  size: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T | undefined;
  error?: string | undefined;
  message?: string | undefined;
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

// DynamoDB Entity Types
export interface AlbumEntity {
  PK: string; // ALBUM#{albumId}
  SK: string; // METADATA
  GSI1PK: string; // ALBUM
  GSI1SK: string; // {createdAt}#{albumId}
  GSI4PK: string; // ALBUM_BY_CREATOR
  GSI4SK: string; // {createdBy}#{createdAt}#{albumId}
  EntityType: "Album";
  id: string;
  title: string;
  tags?: string[] | undefined;
  coverImageUrl?: string | undefined;
  thumbnailUrls?:
    | {
        cover?: string;
        small?: string;
        medium?: string;
        large?: string;
        xlarge?: string;
      }
    | undefined;
  createdAt: string;
  updatedAt: string;
  mediaCount: number;
  isPublic: string; // "true" or "false" - stored as string for GSI compatibility
  likeCount?: number;
  bookmarkCount?: number;
  viewCount?: number;
  commentCount?: number;
  metadata?: Record<string, any> | undefined;
  createdBy?: string | undefined; // User ID who created the album
  createdByType?: "user" | "admin" | undefined; // Type of creator
}

export interface MediaEntity {
  PK: string; // MEDIA#{mediaId}
  SK: string; // METADATA
  GSI1PK: string; // MEDIA_BY_CREATOR
  GSI1SK: string; // {createdBy}#{createdAt}#{mediaId}
  GSI2PK: string; // MEDIA_ID
  GSI2SK: string; // {mediaId}
  EntityType: "Media";
  id: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  width?: number | undefined;
  height?: number | undefined;
  url: string;
  thumbnailUrl?: string | undefined;
  thumbnailUrls?:
    | {
        cover?: string;
        small?: string;
        medium?: string;
        large?: string;
        xlarge?: string;
        originalSize?: string;
      }
    | undefined;
  status?: "pending" | "uploaded" | "failed" | undefined;
  createdAt: string;
  updatedAt: string;
  likeCount?: number;
  bookmarkCount?: number;
  viewCount?: number;
  commentCount?: number;
  metadata?: Record<string, any> | undefined;
  // User tracking fields
  createdBy?: string | undefined; // userId or adminId who uploaded this media
  createdByType?: "user" | "admin" | undefined; // type of creator
}

// New entity for album-media relationships (many-to-many)
export interface AlbumMediaEntity {
  PK: string; // ALBUM#{albumId}
  SK: string; // MEDIA#{mediaId}
  GSI1PK: string; // MEDIA#{mediaId}
  GSI1SK: string; // ALBUM#{albumId}#{addedAt}
  GSI2PK: string; // ALBUM_MEDIA_BY_DATE
  GSI2SK: string; // {addedAt}#{albumId}#{mediaId}
  EntityType: "AlbumMedia";
  albumId: string;
  mediaId: string;
  addedAt: string; // when media was added to this album
  addedBy?: string | undefined; // who added it to this album
}

// Comment Types
export interface Comment {
  id: string;
  content: string;
  targetType: "album" | "media";
  targetId: string;
  userId: string;
  username?: string;
  createdAt: string;
  updatedAt: string;
  likeCount?: number;
  isEdited?: boolean;
}

export interface CreateCommentRequest {
  content: string;
  targetType: "album" | "media";
  targetId: string;
}

export interface UpdateCommentRequest {
  content: string;
}

export interface CommentResponse {
  success: boolean;
  data?: Comment;
  error?: string;
}

// For standalone comment operations (create, update, delete)
export interface CommentListResponse {
  success: boolean;
  data?: {
    comments: Comment[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
  error?: string;
}

// Comment DynamoDB Entity
export interface CommentEntity {
  PK: string; // COMMENT#{commentId}
  SK: string; // METADATA
  GSI1PK: string; // COMMENTS_BY_TARGET
  GSI1SK: string; // {targetType}#{targetId}#{createdAt}#{commentId}
  GSI2PK: string; // COMMENTS_BY_USER
  GSI2SK: string; // {userId}#{createdAt}#{commentId}
  EntityType: "Comment";
  id: string;
  content: string;
  targetType: "album" | "media";
  targetId: string;
  userId: string;
  username?: string;
  createdAt: string;
  updatedAt: string;
  likeCount?: number;
  isEdited?: boolean;
}

// Admin Authentication Types
export interface AdminUser {
  adminId: string;
  username: string;
  createdAt: string;
  isActive: boolean;
}

export interface AdminSession {
  sessionId: string;
  adminId: string;
  adminUsername: string;
  createdAt: string;
  expiresAt: string;
  lastAccessedAt: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  admin: AdminUser;
  sessionId: string;
}

export interface SessionValidationResult {
  isValid: boolean;
  admin?: AdminUser;
  session?: AdminSession;
}

// Admin DynamoDB Entity Types
export interface AdminUserEntity {
  PK: string; // ADMIN#{adminId}
  SK: string; // METADATA
  GSI1PK: string; // ADMIN_USERNAME
  GSI1SK: string; // {username}
  EntityType: "AdminUser";
  adminId: string;
  username: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
  isActive: boolean;
}

export interface AdminSessionEntity {
  PK: string; // SESSION#{sessionId}
  SK: string; // METADATA
  GSI1PK: string; // SESSION_EXPIRY
  GSI1SK: string; // {expiresAt}#{sessionId}
  EntityType: "AdminSession";
  sessionId: string;
  adminId: string;
  adminUsername: string;
  createdAt: string;
  expiresAt: string;
  lastAccessedAt: string;
  ttl: number; // For DynamoDB TTL
}

// Admin Statistics Types
export interface AdminStats {
  totalAlbums: number;
  totalMedia: number;
  publicAlbums: number;
  storageUsed: string;
  storageUsedBytes: number;
}

// Export user types
export * from "./user";
