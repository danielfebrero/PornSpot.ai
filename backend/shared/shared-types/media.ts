// Media-related types
import type { ThumbnailUrls, Metadata, CreatorType, MediaStatus } from "./core";

export interface Media {
  id: string;
  filename: string;
  originalFilename: string;
  type: "media";
  mimeType: string;
  size?: number;
  width?: number;
  height?: number;
  url?: string;
  thumbnailUrl?: string;
  thumbnailUrls?: ThumbnailUrls;
  status?: MediaStatus;
  createdAt: string;
  updatedAt: string;
  isPublic?: boolean;
  likeCount?: number;
  bookmarkCount?: number;
  viewCount?: number;
  commentCount?: number;
  metadata?: Metadata;
  // User tracking fields
  createdBy?: string;
  createdByType?: CreatorType;
  // Album relationships (populated when needed)
  albums?: import("./album").Album[];
  comments?: import("./comment").Comment[];
}

export interface MediaWithSiblings extends Media {
  bulkSiblings?: Media[]; // Other media IDs in the same bulk upload
}

export interface UploadMediaRequest {
  filename: string;
  mimeType: string;
  size: number;
}

export interface AddMediaToAlbumRequest {
  mediaId?: string; // For single media addition
  mediaIds?: string[]; // For bulk media addition
}

export interface RemoveMediaFromAlbumRequest {
  mediaId?: string; // For single media removal
  mediaIds?: string[]; // For bulk media removal
}
