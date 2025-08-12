/*
File objective: Lambda function to handle ComfyUI job completion events from EventBridge
Auth: Triggered by EventBridge - no direct user auth required
Special notes:
- Downloads generated images from ComfyUI
- Uploads images to S3 with proper naming
- Updates queue entry with completion status and result URLs
- Broadcasts completion event to connected WebSocket clients
*/

import { EventBridgeEvent, Context } from "aws-lambda";
import {
  GenerationQueueService,
  QueueEntry,
} from "@shared/services/generation-queue";
import { ApiGatewayManagementApi } from "aws-sdk";
import { S3StorageService } from "@shared/services/s3-storage";
import { ParameterStoreService } from "@shared/utils/parameters";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { S3Service } from "@shared/utils/s3";
import { Media, MediaEntity } from "@shared";
import {
  createMediaEntity,
  createGenerationMetadata,
} from "@shared/utils/media-entity";
import { JobCompletedEvent } from "@shared/shared-types/comfyui-events";
import axios from "axios";

const queueService = GenerationQueueService.getInstance();
const s3Service = S3StorageService.getInstance();
const WEBSOCKET_ENDPOINT = process.env["WEBSOCKET_API_ENDPOINT"];

export const handler = async (
  event: EventBridgeEvent<"Job Completed", JobCompletedEvent>,
  _context: Context
): Promise<void> => {
  console.log("Received job completion event:", JSON.stringify(event, null, 2));

  try {
    const { promptId, executionData } = event.detail;
    const COMFYUI_ENDPOINT =
      await ParameterStoreService.getComfyUIApiEndpoint();

    if (!promptId || !executionData) {
      console.error(
        "Missing prompt ID or execution data in job completion event"
      );
      return;
    }

    // Find queue entry by ComfyUI prompt ID
    const queueEntry = await queueService.findQueueEntryByPromptId(promptId);

    if (!queueEntry) {
      console.warn(`No queue entry found for prompt ID: ${promptId}`);
      return;
    }

    console.log(
      `Found queue entry ${queueEntry.queueId} for completed prompt ${promptId}`
    );

    // Extract generated images from output
    const generatedImages = extractImagesFromOutput(executionData.output);

    if (generatedImages.length === 0) {
      console.warn(
        `No images found in completion output for prompt ${promptId}`
      );
      await handleJobCompletion(queueEntry, [], []);
      return;
    }

    console.log(`Found ${generatedImages.length} generated images`);

    // Create Media entities in DynamoDB FIRST before uploading to S3
    const createdMediaEntities = await createMediaEntitiesFirst(
      queueEntry,
      generatedImages.length
    );

    if (createdMediaEntities.length === 0) {
      throw new Error("Failed to create any media entities in DynamoDB");
    }

    console.log(
      `Created ${createdMediaEntities.length} media entities in DynamoDB`
    );

    // Download and upload images to S3 using predictable filenames
    const uploadedImageUrls: string[] = [];

    for (let index = 0; index < generatedImages.length; index++) {
      const image = generatedImages[index];
      const mediaEntity = createdMediaEntities[index];

      if (!image) {
        console.error(`No image found at index ${index}`);
        continue;
      }

      if (!mediaEntity) {
        console.error(`No media entity found for image ${index}`);
        continue;
      }

      try {
        const imageUrl = await downloadAndUploadImage(
          image,
          queueEntry,
          COMFYUI_ENDPOINT,
          mediaEntity.id
        );
        if (imageUrl) {
          uploadedImageUrls.push(imageUrl);
        }
      } catch (error) {
        console.error(`Failed to process image ${image.filename}:`, error);
        // Continue with other images
      }
    }

    if (uploadedImageUrls.length === 0) {
      throw new Error("Failed to upload any generated images");
    }

    console.log(`Successfully uploaded ${uploadedImageUrls.length} images`);

    // Update queue entry with completion status
    await handleJobCompletion(
      queueEntry,
      uploadedImageUrls,
      createdMediaEntities
    );
  } catch (error) {
    console.error("Error handling job completion event:", error);

    // Try to update queue entry with error status
    if (event.detail.promptId) {
      try {
        const queueEntry = await queueService.findQueueEntryByPromptId(
          event.detail.promptId
        );
        if (queueEntry) {
          await queueService.updateQueueEntry(queueEntry.queueId, {
            status: "failed",
            errorMessage:
              error instanceof Error
                ? error.message
                : "Unknown completion error",
            completedAt: Date.now().toString(),
          });
        }
      } catch (updateError) {
        console.error(
          "Failed to update queue entry with error status:",
          updateError
        );
      }
    }

    throw error;
  }
};

function extractImagesFromOutput(
  output: any
): Array<{ filename: string; subfolder: string; type: string }> {
  const images: Array<{ filename: string; subfolder: string; type: string }> =
    [];

  for (const nodeId in output) {
    const nodeOutput = output[nodeId];
    if (nodeOutput.images && Array.isArray(nodeOutput.images)) {
      images.push(...nodeOutput.images);
    }
  }

  return images;
}

async function createMediaEntitiesFirst(
  queueEntry: QueueEntry,
  imageCount: number
): Promise<MediaEntity[]> {
  const createdEntities: MediaEntity[] = [];

  console.log(
    `💾 Creating ${imageCount} media entities in DynamoDB for generation: ${queueEntry.queueId}`
  );

  for (let index = 0; index < imageCount; index++) {
    try {
      const mediaId = `${queueEntry.queueId}_${index}`;
      const fileExtension = "jpg"; // Default to JPG for generated images
      const customFilename = `${mediaId}.${fileExtension}`;
      const s3Key = `generated/${queueEntry.queueId}/${customFilename}`;

      // Generate relative URL from S3 key
      const relativeUrl = S3Service.getRelativePath(s3Key);

      // Extract dimensions from queue parameters or use defaults
      const width = queueEntry.parameters.width || 1024;
      const height = queueEntry.parameters.height || 1024;

      // Create generation-specific metadata
      const generationMetadata = createGenerationMetadata({
        prompt: queueEntry.parameters.prompt || "Generated image",
        negativePrompt: queueEntry.parameters.negativePrompt || "",
        width,
        height,
        generationId: queueEntry.queueId,
        selectedLoras: queueEntry.parameters?.selectedLoras || [],
        batchCount: imageCount,
        loraStrengths: queueEntry.parameters?.loraStrengths || {},
        loraSelectionMode: queueEntry.parameters?.loraSelectionMode,
        optimizePrompt: queueEntry.parameters?.optimizePrompt || false,
      });

      // Create MediaEntity for database storage using shared utility
      const mediaEntity: MediaEntity = createMediaEntity({
        mediaId,
        userId: queueEntry.userId,
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
      createdEntities.push(mediaEntity);

      console.log(`✅ Created media entity ${mediaId} in DynamoDB`);
    } catch (error) {
      const errorMessage = `Failed to create media entity ${index}: ${
        error instanceof Error ? error.message : String(error)
      }`;
      console.error(`❌ ${errorMessage}`);
      // Continue with other entities - we'll handle partial failures
    }
  }

  // Update user metrics for generated media
  if (createdEntities.length > 0) {
    try {
      // Increment totalGeneratedMedias metric for each created media
      await DynamoDBService.incrementUserProfileMetric(
        queueEntry.userId,
        "totalGeneratedMedias",
        createdEntities.length
      );
      console.log(
        `📈 Incremented totalGeneratedMedias by ${createdEntities.length} for user: ${queueEntry.userId}`
      );
    } catch (error) {
      console.warn(
        `⚠️ Failed to update user metrics for ${queueEntry.userId}:`,
        error
      );
      // Don't fail the entire operation if metrics update fails
    }
  }

  console.log(
    `💾 Created ${createdEntities.length}/${imageCount} media entities in DynamoDB`
  );

  return createdEntities;
}

async function downloadAndUploadImage(
  image: { filename: string; subfolder: string; type: string },
  queueEntry: QueueEntry,
  comfyuiEndpoint: string,
  mediaId: string
): Promise<string | null> {
  try {
    // Download image from ComfyUI
    const imageUrl = `${comfyuiEndpoint}/view?filename=${encodeURIComponent(
      image.filename
    )}&subfolder=${encodeURIComponent(
      image.subfolder
    )}&type=${encodeURIComponent(image.type)}`;

    console.log(`Downloading image from: ${imageUrl}`);

    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      timeout: 30000, // 30 second timeout
    });

    if (response.status !== 200) {
      throw new Error(`Failed to download image: HTTP ${response.status}`);
    }

    const imageBuffer = Buffer.from(response.data);

    // Generate file extension for the image
    const fileExtension = image.filename.split(".").pop() || "png";
    const customFilename = `${mediaId}.${fileExtension}`;

    // Upload to S3 with custom filename
    const result = await s3Service.uploadGeneratedImageWithCustomFilename(
      imageBuffer,
      queueEntry.queueId,
      customFilename,
      `image/${fileExtension}`
    );

    console.log(`Successfully uploaded image to S3: ${result.publicUrl}`);

    return result.publicUrl;
  } catch (error) {
    console.error(`Failed to download/upload image ${image.filename}:`, error);
    return null;
  }
}

async function handleJobCompletion(
  queueEntry: QueueEntry,
  imageUrls: string[],
  createdMediaEntities: MediaEntity[]
): Promise<void> {
  try {
    // Convert MediaEntities to Media objects for response
    const mediaObjects: Media[] = createdMediaEntities.map((mediaEntity) =>
      DynamoDBService.convertMediaEntityToMedia(mediaEntity)
    );

    console.log(
      `Using ${mediaObjects.length} already-created Media entities for job completion`
    );

    // Update queue entry with completion status
    await queueService.updateQueueEntry(queueEntry.queueId, {
      status: "completed",
      resultImageUrl: imageUrls[0] || undefined, // Primary image URL
      completedAt: Date.now().toString(),
    });

    console.log(
      `Updated queue entry ${queueEntry.queueId} status to completed`
    );

    // Broadcast completion to connected WebSocket clients
    if (WEBSOCKET_ENDPOINT && queueEntry.connectionId) {
      await broadcastCompletion(queueEntry, mediaObjects);
    }
  } catch (error) {
    console.error("Error handling job completion:", error);
    throw error;
  }
}

async function broadcastCompletion(
  queueEntry: QueueEntry,
  medias: Media[]
): Promise<void> {
  if (!WEBSOCKET_ENDPOINT || !queueEntry.connectionId) {
    return;
  }

  try {
    const apiGateway = new ApiGatewayManagementApi({
      endpoint: WEBSOCKET_ENDPOINT,
    });

    const message = {
      type: "completed",
      queueId: queueEntry.queueId,
      promptId: queueEntry.comfyPromptId,
      timestamp: new Date().toISOString(),
      status: "completed",
      message: "Generation completed successfully!",
      medias,
    };

    await apiGateway
      .postToConnection({
        ConnectionId: queueEntry.connectionId,
        Data: JSON.stringify(message),
      })
      .promise();

    console.log(
      `Broadcasted completion to connection ${queueEntry.connectionId}`
    );
  } catch (error: any) {
    if (error.statusCode === 410) {
      console.log(`Connection ${queueEntry.connectionId} is stale, removing`);
      // Remove stale connection ID from queue entry
      await queueService.updateQueueEntry(queueEntry.queueId, {
        connectionId: undefined,
      });
    } else {
      console.error("Error broadcasting completion:", error);
    }
  }
}
