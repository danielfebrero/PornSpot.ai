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
  size?: number;
  url?: string; // Relative URL from S3Service.getRelativePath()

  // Optional dimensions
  width?: number;
  height?: number;

  // Optional metadata
  metadata?: Metadata;

  // Optional visibility (defaults to true for public)
  isPublic?: boolean;

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

  type: "image" | "video";
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

    // GSI3: Media by user and public status for efficient filtering
    GSI3PK: `MEDIA_BY_USER_${
      options.isPublic !== undefined ? String(options.isPublic) : "true"
    }`,
    GSI3SK: `${options.userId}#${now}#${options.mediaId}`,

    // GSI4: Media entity type and current time
    GSI4PK: "MEDIA",
    GSI4SK: `${now}#${options.mediaId}`,

    // GSI5: Media by public status
    GSI5PK: "MEDIA",
    GSI5SK: options.isPublic !== undefined ? String(options.isPublic) : "true",

    // GSI6: Popularity score
    GSI6PK: "POPULARITY",
    GSI6SK: 0,

    GSI7PK: "CONTENT",
    GSI7SK: `${now}`,

    GSI8PK: "MEDIA_BY_TYPE_AND_CREATOR",
    GSI8SK: `${options.type}#${options.userId}#${now}#${options.mediaId}`,

    // Entity metadata
    EntityType: "Media" as const,
    id: options.mediaId,

    // File properties
    filename: options.filename,
    originalFilename: options.originalFilename,
    mimeType: options.mimeType,
    size: options.size,
    url: options.url,
    type: options.type,

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

    // Visibility (stored as string for GSI compatibility)
    isPublic:
      options.isPublic !== undefined ? String(options.isPublic) : "true",

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
  bulkSiblings?: string[];
  cfgScale: number;
  steps: number;
  seed: number;
  originalMediaId?: string;
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
    ...(options.bulkSiblings && { bulkSiblings: options.bulkSiblings }),
    cfgScale: options.cfgScale,
    steps: options.steps,
    seed: options.seed,
    ...(options.originalMediaId && {
      originalMediaId: options.originalMediaId,
    }),
  };
}
