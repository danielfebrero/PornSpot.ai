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
import axios from "axios";

interface JobCompletionEventDetail {
  promptId: string;
  timestamp: string;
  executed: {
    promptId: string;
    output: {
      [nodeId: string]: {
        images?: Array<{
          filename: string;
          subfolder: string;
          type: string;
        }>;
      };
    };
  };
}

const queueService = GenerationQueueService.getInstance();
const s3Service = S3StorageService.getInstance();
const WEBSOCKET_ENDPOINT = process.env["WEBSOCKET_API_ENDPOINT"];
const COMFYUI_ENDPOINT =
  process.env["COMFYUI_API_ENDPOINT"] || "http://localhost:8188";

export const handler = async (
  event: EventBridgeEvent<"ComfyUI Job Completion", JobCompletionEventDetail>,
  _context: Context
): Promise<void> => {
  console.log("Received job completion event:", JSON.stringify(event, null, 2));

  try {
    const { promptId, executed } = event.detail;

    if (!promptId || !executed) {
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
    const generatedImages = extractImagesFromOutput(executed.output);

    if (generatedImages.length === 0) {
      console.warn(
        `No images found in completion output for prompt ${promptId}`
      );
      await handleJobCompletion(queueEntry, []);
      return;
    }

    console.log(`Found ${generatedImages.length} generated images`);

    // Download and upload images to S3
    const uploadedImageUrls: string[] = [];

    for (const image of generatedImages) {
      try {
        const imageUrl = await downloadAndUploadImage(image, queueEntry);
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
    await handleJobCompletion(queueEntry, uploadedImageUrls);
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
            completedAt: Date.now(),
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

async function downloadAndUploadImage(
  image: { filename: string; subfolder: string; type: string },
  queueEntry: QueueEntry
): Promise<string | null> {
  try {
    // Download image from ComfyUI
    const imageUrl = `${COMFYUI_ENDPOINT}/view?filename=${encodeURIComponent(
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

    // Upload to S3
    const result = await s3Service.uploadGeneratedImage(
      imageBuffer,
      queueEntry.queueId,
      0,
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
  imageUrls: string[]
): Promise<void> {
  try {
    // Update queue entry with completion status
    await queueService.updateQueueEntry(queueEntry.queueId, {
      status: "completed",
      resultImageUrl: imageUrls[0] || undefined, // Primary image URL
      completedAt: Date.now(),
    });

    console.log(
      `Updated queue entry ${queueEntry.queueId} status to completed`
    );

    // Broadcast completion to connected WebSocket clients
    if (WEBSOCKET_ENDPOINT && queueEntry.connectionId) {
      await broadcastCompletion(queueEntry, imageUrls);
    }
  } catch (error) {
    console.error("Error handling job completion:", error);
    throw error;
  }
}

async function broadcastCompletion(
  queueEntry: QueueEntry,
  imageUrls: string[]
): Promise<void> {
  if (!WEBSOCKET_ENDPOINT || !queueEntry.connectionId) {
    return;
  }

  try {
    const apiGateway = new ApiGatewayManagementApi({
      endpoint: WEBSOCKET_ENDPOINT,
    });

    const message = {
      type: "job_completed",
      queueId: queueEntry.queueId,
      promptId: queueEntry.comfyPromptId,
      timestamp: new Date().toISOString(),
      status: "completed",
      imageUrls,
      primaryImageUrl: imageUrls[0],
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
