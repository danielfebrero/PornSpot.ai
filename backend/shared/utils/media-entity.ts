/*
File objective: Shared utility for creating MediaEntity objects
Auth: Available to generation and upload functions
Special notes:
- Provides a consistent way to create MediaEntity objects
- Handles common properties and allows for customization
- Ensures GSI indexes are properly set up
- Supports both uploaded media and AI-generated content
*/

import { MediaEntity, Metadata } from "@shared";

export interface CreateMediaEntityOptions {
  // Required core properties
  mediaId: string;
  userId: string;
  filename: string; // S3 key for generated, display filename for uploads
  originalFilename: string;
  mimeType: string;
  size: number;
  url: string; // Relative URL from S3Service.getRelativePath()

  // Optional dimensions
  width?: number;
  height?: number;

  // Optional metadata
  metadata?: Metadata;

  // Optional status (defaults to "pending")
  status?: "pending" | "uploaded" | "failed";

  // Optional creator type (defaults to "user")
  createdByType?: "user" | "admin";

  // Optional interaction counts (defaults to 0)
  likeCount?: number;
  bookmarkCount?: number;
  viewCount?: number;
  commentCount?: number;

  // Optional thumbnail URLs (usually set by process-upload worker)
  thumbnailUrl?: string;
  thumbnailUrls?: import("@shared").ThumbnailUrls;
}

/**
 * Creates a MediaEntity object with consistent structure and GSI indexes
 * @param options Media entity creation options
 * @returns Complete MediaEntity ready for DynamoDB storage
 */
export function createMediaEntity(
  options: CreateMediaEntityOptions
): MediaEntity {
  const now = new Date().toISOString();

  const mediaEntity: MediaEntity = {
    // Primary key structure
    PK: `MEDIA#${options.mediaId}`,
    SK: "METADATA",

    // GSI1: Media by creator for user queries
    GSI1PK: "MEDIA_BY_CREATOR",
    GSI1SK: `${options.userId}#${now}#${options.mediaId}`,

    // GSI2: Direct media lookup by ID
    GSI2PK: "MEDIA_ID",
    GSI2SK: options.mediaId,

    // Entity metadata
    EntityType: "Media" as const,
    id: options.mediaId,

    // File properties
    filename: options.filename,
    originalFilename: options.originalFilename,
    mimeType: options.mimeType,
    size: options.size,
    url: options.url,

    // Optional dimensions
    ...(options.width !== undefined && { width: options.width }),
    ...(options.height !== undefined && { height: options.height }),

    // Thumbnail properties (usually set later by process-upload worker)
    ...(options.thumbnailUrl !== undefined && {
      thumbnailUrl: options.thumbnailUrl,
    }),
    ...(options.thumbnailUrls !== undefined && {
      thumbnailUrls: options.thumbnailUrls,
    }),

    // Status and timestamps
    status: options.status || "pending",
    createdAt: now,
    updatedAt: now,

    // Interaction counts
    likeCount: options.likeCount || 0,
    bookmarkCount: options.bookmarkCount || 0,
    viewCount: options.viewCount || 0,
    commentCount: options.commentCount || 0,

    // Creator information
    createdBy: options.userId,
    createdByType: options.createdByType || "user",

    // Optional metadata
    ...(options.metadata && { metadata: options.metadata }),
  };

  return mediaEntity;
}

/**
 * Creates metadata object for AI-generated media
 * @param options Generation-specific metadata
 * @returns Metadata object for generated content
 */
export function createGenerationMetadata(options: {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  generationId: string;
  selectedLoras?: string[];
  batchCount: number;
  loraStrengths?: Record<string, { mode: "auto" | "manual"; value: number }>;
  loraSelectionMode?: "auto" | "manual";
  optimizePrompt?: boolean;
  customWidth?: number;
  customHeight?: number;
}): Metadata {
  return {
    prompt: options.prompt.trim(),
    negativePrompt: options.negativePrompt || undefined,
    width: options.width,
    height: options.height,
    generationId: options.generationId,
    batchCount: options.batchCount,
    selectedLoras:
      options.selectedLoras && options.selectedLoras.length > 0
        ? options.selectedLoras
        : undefined,
    estimatedTime: Math.round(options.batchCount * 2000 + Math.random() * 1000),
    isGenerated: true, // Flag to identify AI-generated content
    ...(options.loraStrengths && { loraStrengths: options.loraStrengths }),
    ...(options.loraSelectionMode && {
      loraSelectionMode: options.loraSelectionMode,
    }),
    ...(options.optimizePrompt !== undefined && {
      optimizePrompt: options.optimizePrompt,
    }),
    ...(options.customWidth && { customWidth: options.customWidth }),
    ...(options.customHeight && { customHeight: options.customHeight }),
  };
}
