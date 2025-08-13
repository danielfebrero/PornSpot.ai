// Album-related types
import type { ThumbnailUrls, Metadata, CreatorType } from "./core";

export interface Album {
  id: string;
  title: string;
  type: "album";
  tags?: string[];
  coverImageUrl?: string;
  thumbnailUrls?: ThumbnailUrls;
  createdAt: string;
  updatedAt: string;
  mediaCount: number;
  isPublic: boolean;
  likeCount?: number;
  bookmarkCount?: number;
  viewCount?: number;
  commentCount?: number;
  metadata?: Metadata;
  // User tracking fields
  createdBy?: string; // userId or adminId who created this album
  createdByType?: CreatorType; // type of creator
  comments?: import("./comment").Comment[]; // Include comments directly in Album
}

export interface CreateAlbumRequest {
  title: string;
  tags?: string[];
  isPublic?: boolean; // Made optional to match frontend usage
  mediaIds?: string[]; // For user album creation with selected media
  coverImageId?: string; // Media ID to use as cover image
}

export interface UpdateAlbumRequest {
  title?: string;
  tags?: string[];
  isPublic?: boolean;
  coverImageUrl?: string;
}

export interface BulkDeleteAlbumsRequest {
  albumIds: string[];
}
