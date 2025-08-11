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
import { S3Service } from "@shared/utils/s3";
import { Media, MediaEntity } from "@shared";
import {
  createMediaEntity,
  createGenerationMetadata,
} from "@shared/utils/media-entity";

interface SaveGeneratedMediaOptions {
  userId: string;
  generationId: string;
  batchCount: number;
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  selectedLoras?: string[];
  s3Keys: string[]; // S3 keys for the generated images
  loraStrengths?: Record<string, { mode: "auto" | "manual"; value: number }>;
  loraSelectionMode?: "auto" | "manual";
  optimizePrompt?: boolean;
  customWidth?: number;
  customHeight?: number;
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
    width,
    height,
    selectedLoras = [],
    s3Keys,
    loraStrengths,
    loraSelectionMode,
    optimizePrompt,
    customWidth,
    customHeight,
  } = options;

  const result: GeneratedMediaResult = {
    mediaEntities: [],
    savedCount: 0,
    errors: [],
  };

  console.log(
    `💾 Saving ${batchCount} generated media items to database for user: ${userId}`
  );

  // Process each generated image
  for (let index = 0; index < batchCount; index++) {
    try {
      const mediaId = `${generationId}_${index}`;
      const s3Key = s3Keys[index];

      // Validate that we have an S3 key for this index
      if (!s3Key) {
        throw new Error(`Missing S3 key for image at index ${index}`);
      }

      // Generate relative URL from S3 key
      const relativeUrl = S3Service.getRelativePath(s3Key);

      // Create generation-specific metadata
      const generationMetadata = createGenerationMetadata({
        prompt,
        negativePrompt,
        width,
        height,
        generationId,
        selectedLoras,
        batchCount,
        loraStrengths,
        loraSelectionMode,
        optimizePrompt,
        customWidth,
        customHeight,
      });

      // Create MediaEntity for database storage using shared utility
      const mediaEntity: MediaEntity = createMediaEntity({
        mediaId,
        userId,
        filename: s3Key, // Use S3 key as filename
        originalFilename: `generated_${index + 1}.jpg`,
        mimeType: "image/jpeg",
        size: width * height * 3, // Rough estimate for JPEG
        width,
        height,
        url: relativeUrl, // Use relative URL from S3 key
        metadata: generationMetadata,
        // Thumbnails will be set by process-upload worker
        // Status defaults to "pending" and will be updated by process-upload worker
        // Interaction counts default to 0
        // createdByType defaults to "user"
      });

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
      await DynamoDBService.incrementUserProfileMetric(
        userId,
        "totalGeneratedMedias",
        result.savedCount
      );
      console.log(
        `📈 Incremented totalGeneratedMedias by ${result.savedCount} for user: ${userId}`
      );
    } catch (error) {
      console.warn(`⚠️ Failed to update user metrics for ${userId}:`, error);
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

  if (!options.width || !options.height) {
    errors.push("Image width and height are required");
  }

  if (!options.s3Keys || options.s3Keys.length !== options.batchCount) {
    errors.push("S3 keys must match batch count");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
