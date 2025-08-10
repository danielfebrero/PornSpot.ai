/*
File objective: Utility functions for saving AI-generated media to the database
Auth: Used by the generation endpoint after creating Media objects
Special notes:
- Creates MediaEntity records in DynamoDB for generated images
- Handles proper entity structure with GSI indexes
- Integrates with user metrics tracking
- Supports bulk creation for batch generations
*/

import { DynamoDBService } from "@shared/utils/dynamodb";
import { Media, MediaEntity } from "@shared";

interface SaveGeneratedMediaOptions {
  userId: string;
  generationId: string;
  batchCount: number;
  prompt: string;
  negativePrompt?: string;
  imageSize: string;
  selectedLoras?: string[];
  mockUrls: string[]; // Temporary - will be replaced with actual generation service
}

interface GeneratedMediaResult {
  mediaEntities: Media[];
  savedCount: number;
  errors: string[];
}

/**
 * Saves AI-generated media objects to the database
 * @param options Generation parameters and metadata
 * @returns Array of saved Media objects and operation results
 */
export async function saveGeneratedMediaToDatabase(
  options: SaveGeneratedMediaOptions
): Promise<GeneratedMediaResult> {
  const {
    userId,
    generationId,
    batchCount,
    prompt,
    negativePrompt,
    imageSize,
    selectedLoras = [],
    mockUrls,
  } = options;

  const result: GeneratedMediaResult = {
    mediaEntities: [],
    savedCount: 0,
    errors: [],
  };

  const now = new Date().toISOString();

  console.log(
    `💾 Saving ${batchCount} generated media items to database for user: ${userId}`
  );

  // Process each generated image
  for (let index = 0; index < batchCount; index++) {
    try {
      const mediaId = `${generationId}_${index}`;
      const filename = `generated_${mediaId}.jpg`;
      const mockUrl = mockUrls[index];

      // Validate that we have a URL for this index
      if (!mockUrl) {
        throw new Error(`Missing URL for image at index ${index}`);
      }

      // Extract dimensions from imageSize
      const [widthStr, heightStr] = imageSize.split("x");
      const width = parseInt(widthStr || "1024");
      const height = parseInt(heightStr || "1024");

      // Create MediaEntity for database storage
      const mediaEntity: MediaEntity = {
        PK: `MEDIA#${mediaId}`,
        SK: "METADATA",
        GSI1PK: "MEDIA_BY_CREATOR",
        GSI1SK: `${userId}#${now}#${mediaId}`,
        GSI2PK: "MEDIA_ID",
        GSI2SK: mediaId,
        EntityType: "Media" as const,
        id: mediaId,
        filename,
        originalFilename: `generated_${index + 1}.jpg`,
        mimeType: "image/jpeg",
        size: width * height * 3, // Rough estimate for JPEG
        width,
        height,
        url: mockUrl, // TODO: Replace with actual generated image URL
        thumbnailUrl: mockUrl, // For now, use same URL as thumbnail
        thumbnailUrls: {
          cover: mockUrl,
          small: mockUrl,
          medium: mockUrl,
          large: mockUrl,
          xlarge: mockUrl,
          originalSize: mockUrl,
        },
        status: "uploaded" as const, // Generated images are immediately "uploaded"
        createdAt: now,
        updatedAt: now,
        likeCount: 0,
        bookmarkCount: 0,
        viewCount: 0,
        commentCount: 0,
        metadata: {
          prompt: prompt.trim(),
          negativePrompt: negativePrompt || undefined,
          imageSize,
          generationId,
          selectedLoras: selectedLoras.length > 0 ? selectedLoras : undefined,
          estimatedTime: Math.round(batchCount * 2000 + Math.random() * 1000),
          isGenerated: true, // Flag to identify AI-generated content
        },
        createdBy: userId,
        createdByType: "user" as const,
      };

      // Save to database
      await DynamoDBService.createMedia(mediaEntity);

      // Convert MediaEntity to Media for response
      const media = DynamoDBService.convertMediaEntityToMedia(mediaEntity);
      result.mediaEntities.push(media);
      result.savedCount++;

      console.log(`✅ Saved generated media ${mediaId} to database`);
    } catch (error) {
      const errorMessage = `Failed to save media ${index}: ${
        error instanceof Error ? error.message : String(error)
      }`;
      console.error(`❌ ${errorMessage}`);
      result.errors.push(errorMessage);
    }
  }

  // Update user metrics for generated media
  if (result.savedCount > 0) {
    try {
      // Increment totalGeneratedMedias metric for each saved media
      for (let i = 0; i < result.savedCount; i++) {
        await DynamoDBService.incrementUserProfileMetric(
          userId,
          "totalGeneratedMedias"
        );
      }
      console.log(
        `📈 Incremented totalGeneratedMedias by ${result.savedCount} for user: ${userId}`
      );
    } catch (error) {
      console.warn(
        `⚠️ Failed to update user metrics for ${userId}:`,
        error
      );
      // Don't fail the entire operation if metrics update fails
    }
  }

  console.log(
    `💾 Database save complete: ${result.savedCount}/${batchCount} media items saved, ${result.errors.length} errors`
  );

  return result;
}

/**
 * Creates a unique generation ID for tracking related media
 * @returns Unique generation identifier
 */
export function createGenerationId(): string {
  return `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validates generation parameters before saving
 * @param options Generation options to validate
 * @returns Validation result with any errors
 */
export function validateGenerationOptions(
  options: Partial<SaveGeneratedMediaOptions>
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!options.userId) {
    errors.push("User ID is required");
  }

  if (!options.generationId) {
    errors.push("Generation ID is required");
  }

  if (!options.batchCount || options.batchCount < 1) {
    errors.push("Batch count must be at least 1");
  }

  if (!options.prompt || options.prompt.trim().length === 0) {
    errors.push("Prompt is required");
  }

  if (!options.imageSize) {
    errors.push("Image size is required");
  }

  if (!options.mockUrls || options.mockUrls.length !== options.batchCount) {
    errors.push("Mock URLs must match batch count");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
