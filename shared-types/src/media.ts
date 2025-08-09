// Media-related types
import type { ThumbnailUrls, Metadata, CreatorType, MediaStatus, TargetType } from "./core";

export interface Media {
  id: string;
  filename: string;
  originalFilename: string;
  type: "media";
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  url: string;
  thumbnailUrl?: string;
  thumbnailUrls?: ThumbnailUrls;
  status?: MediaStatus;
  createdAt: string;
  updatedAt: string;
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