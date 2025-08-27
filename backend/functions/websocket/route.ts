/*
File objective: Handle WebSocket message routing and subscription management
Auth: Connection-based (validates connection exists)
Special notes:
- Routes different message types (subscribe, unsubscribe, etc.)
- Manages subscriptions to generation updates by queueId
- Sends responses back through WebSocket connection
*/

import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import {
  DynamoDBDocumentClient,
  GetCommand,
  DeleteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  GenerationQueueService,
  QueueEntry,
} from "@shared/services/generation-queue";
import { WebSocketMessage } from "@shared/shared-types/websocket";
import {
  DynamoDBService,
  Media,
  MediaEntity,
  ParameterStoreService,
  S3Service,
} from "@shared";

import {
  createMediaEntity,
  createGenerationMetadata,
} from "@shared/utils/media-entity";
import { extractClientIP } from "@shared/utils/ip-extraction";
import axios from "axios";
import { S3StorageService } from "@shared/services/s3-storage";

interface ComfyUINode {
  value: number;
  max: number;
  state: string;
  node_id: string;
  prompt_id: string;
  display_node_id: string;
  parent_node_id: string | null;
  real_node_id: string;
}

interface ComfyUIProgressState {
  type: "progress_state";
  data: {
    prompt_id: string;
    nodes: Record<string, ComfyUINode>;
  };
}

interface ProgressData {
  nodeId: string;
  displayNodeId: string;
  currentNode: string;
  nodeName: string;
  value: number;
  max: number;
  percentage: number;
  nodeState: string;
  parentNodeId: string | null;
  realNodeId: string;
  nodeTitle: string;
  message: string;
}

interface ComfyUIImage {
  filename: string;
  subfolder: string;
  type: string;
}

interface ComfyUIExecutedMessage {
  type: "executed";
  data: {
    prompt_id: string;
    node: string;
    output: {
      images?: ComfyUIImage[];
      [key: string]: any;
    };
  };
}

// Initialize DynamoDB client
const isLocal = process.env["AWS_SAM_LOCAL"] === "true";
const clientConfig: any = {};

if (isLocal) {
  clientConfig.endpoint = "http://pornspot-local-aws:4566";
  clientConfig.region = "us-east-1";
  clientConfig.credentials = {
    accessKeyId: "test",
    secretAccessKey: "test",
  };
}

const dynamoClient = new DynamoDBClient(clientConfig);
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const TABLE_NAME = process.env["DYNAMODB_TABLE"]!;
const queueService = GenerationQueueService.getInstance();
const s3Service = S3StorageService.getInstance();
const WEBSOCKET_ENDPOINT = process.env["WEBSOCKET_API_ENDPOINT"];

// Initialize API Gateway Management API client
const apiGatewayClient = new ApiGatewayManagementApiClient({
  endpoint: WEBSOCKET_ENDPOINT,
});

// Local cache for prompt_id -> queueEntry mappings to avoid repeated DB queries
const promptIdToQueueEntryCache = new Map<
  string,
  {
    queueId: string;
    connectionId?: string;
    comfyPromptId: string;
    timestamp: number; // For cache expiration
  }
>();

// Cache TTL: 5 minutes (in milliseconds)
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Get queue entry from cache or database
 */
async function getQueueEntryWithCache(promptId: string) {
  const now = Date.now();

  // Check cache first
  const cached = promptIdToQueueEntryCache.get(promptId);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    console.log(`📦 Cache hit for prompt ID: ${promptId}`);
    return {
      queueId: cached.queueId,
      connectionId: cached.connectionId,
      comfyPromptId: cached.comfyPromptId,
    };
  }

  // Cache miss or expired, fetch from database
  console.log(`🔍 Cache miss for prompt ID: ${promptId}, querying database`);
  const queueEntry = await queueService.findQueueEntryByPromptId(promptId);

  if (queueEntry) {
    // Update cache
    promptIdToQueueEntryCache.set(promptId, {
      queueId: queueEntry.queueId,
      connectionId: queueEntry.connectionId,
      comfyPromptId: queueEntry.comfyPromptId || promptId, // Use promptId as fallback
      timestamp: now,
    });
    console.log(`💾 Cached queue entry for prompt ID: ${promptId}`);
  }

  return queueEntry;
}

/**
 * Remove expired entries from cache
 */
function cleanupExpiredCache() {
  const now = Date.now();
  const expiredKeys: string[] = [];

  for (const [promptId, cached] of promptIdToQueueEntryCache.entries()) {
    if (now - cached.timestamp >= CACHE_TTL) {
      expiredKeys.push(promptId);
    }
  }

  expiredKeys.forEach((key) => {
    promptIdToQueueEntryCache.delete(key);
    console.log(`🧹 Removed expired cache entry for prompt ID: ${key}`);
  });
}

/**
 * Remove cache entries for a specific connection ID
 */
function cleanupCacheByConnectionId(connectionId: string) {
  const keysToRemove: string[] = [];

  for (const [promptId, cached] of promptIdToQueueEntryCache.entries()) {
    if (cached.connectionId === connectionId) {
      keysToRemove.push(promptId);
    }
  }

  keysToRemove.forEach((key) => {
    promptIdToQueueEntryCache.delete(key);
    console.log(
      `🧹 Removed cache entry for gone connection ${connectionId}, prompt ID: ${key}`
    );
  });
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("📨 WebSocket route event:", JSON.stringify(event, null, 2));

  try {
    const connectionId = event.requestContext.connectionId;
    if (!connectionId) {
      console.error("❌ No connection ID provided");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No connection ID" }),
      };
    }

    // Parse message body
    let message: WebSocketMessage;
    try {
      message = JSON.parse(event.body || "{}");
    } catch (error) {
      console.error("❌ Invalid JSON in message body:", error);
      await sendErrorToConnection(connectionId, "Invalid JSON format");
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Invalid JSON handled" }),
      };
    }

    console.log(`📥 Received message for connection ${connectionId}:`, message);

    // Route message based on action
    switch (message.action) {
      case "get_client_connectionId":
        await handleGetClientConnectionId(connectionId);
        break;

      case "subscribe":
        await handleSubscribe(connectionId, message);
        break;

      case "unsubscribe":
        await handleUnsubscribe(connectionId, message);
        break;

      case "ping":
        await handlePing(connectionId, message, event);
        break;

      default:
        switch (message.type) {
          case "progress_state":
            await handleProgressState(message as ComfyUIProgressState);
            break;

          case "executed":
            await handleGenerationComplete(message as ComfyUIExecutedMessage);
            break;

          default:
            console.info(
              `⚠️ Unknown action, message: ${JSON.stringify(message)}`
            );
            break;
        }
        // await sendErrorToConnection(
        //   connectionId,
        //   `Unknown action: ${message.action}`,
        //   message.requestId
        // );
        break;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Message processed" }),
    };
  } catch (error) {
    console.error("❌ WebSocket route error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Message processing failed" }),
    };
  }
};

async function createMediaEntitiesFirst(
  queueEntry: QueueEntry,
  images: Array<{ filename: string; subfolder: string; type: string }>
): Promise<MediaEntity[]> {
  const createdEntities: MediaEntity[] = [];

  console.log(
    `💾 Creating ${images.length} media entities in DynamoDB for generation: ${queueEntry.queueId}`
  );

  const mediaIds = images.map((_, index) => `${queueEntry.queueId}_${index}`);

  for (let index = 0; index < images.length; index++) {
    const image = images[index];

    if (!image) {
      console.error(`No image found at index ${index}`);
      continue;
    }

    try {
      const mediaId = `${queueEntry.queueId}_${index}`;
      // Extract file extension from the actual image filename
      const fileExtension = image.filename.split(".").pop() || "jpg";
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
        batchCount: images.length,
        loraStrengths: queueEntry.parameters?.loraStrengths || {},
        loraSelectionMode: queueEntry.parameters?.loraSelectionMode,
        optimizePrompt: queueEntry.parameters?.optimizePrompt || false,
        bulkSiblings:
          mediaIds.length > 1
            ? mediaIds.filter((id) => id !== mediaId)
            : undefined,
        cfgScale: queueEntry.parameters.cfg_scale || 4.5,
        steps: queueEntry.parameters.steps || 30,
        seed: queueEntry.parameters.seed || -1,
      });

      // Create MediaEntity for database storage using shared utility
      const mediaEntity: MediaEntity = createMediaEntity({
        mediaId,
        userId: queueEntry.userId || "ANONYMOUS",
        filename: s3Key, // Use S3 key as filename
        originalFilename: queueEntry.filename || image.filename, // Use actual ComfyUI filename
        mimeType: `image/${fileExtension}`, // Use actual file extension for MIME type
        width,
        height,
        url: relativeUrl, // Use relative URL from S3 key
        metadata: generationMetadata,
        isPublic: queueEntry.parameters.isPublic,
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
  if (createdEntities.length > 0 && queueEntry.userId) {
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
    `💾 Created ${createdEntities.length}/${images.length} media entities in DynamoDB`
  );

  return createdEntities;
}

async function downloadAndUploadImage(
  image: { filename: string; subfolder: string; type: string },
  queueEntry: QueueEntry,
  comfyuiEndpoint: string,
  mediaId: string
): Promise<string | null> {
  // Download image from ComfyUI
  const imageUrl = `${comfyuiEndpoint}/view?filename=${encodeURIComponent(
    image.filename
  )}&subfolder=${encodeURIComponent(image.subfolder)}&type=${encodeURIComponent(
    image.type
  )}`;

  console.log(`Downloading image from: ${imageUrl}`);

  // Retry logic for downloading images with better timeout handling
  const maxRetries = 3;
  const retryDelays = [1000, 2000, 5000]; // Progressive backoff: 1s, 2s, 5s
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(
        `Download attempt ${attempt + 1}/${maxRetries} for ${image.filename}`
      );

      const response = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        timeout: 10000, // Timeout to 10 seconds
        maxRedirects: 5,
        headers: {
          Accept: "image/*",
          "User-Agent": "PornSpot-ImageDownloader/1.0",
        },
        // Prevent axios from throwing on HTTP error status codes
        validateStatus: (status) => status < 500, // Only retry on 5xx errors
      });

      if (response.status !== 200) {
        throw new Error(`Failed to download image: HTTP ${response.status}`);
      }

      console.log(
        `Successfully downloaded image ${image.filename} on attempt ${
          attempt + 1
        }`
      );

      const imageBuffer = Buffer.from(response.data);

      // Validate that we actually got image data
      if (imageBuffer.length === 0) {
        throw new Error("Downloaded image is empty");
      }

      console.log(`Downloaded image size: ${imageBuffer.length} bytes`);

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

      // Update media entity in DynamoDB with image dimensions, file size, and URL
      try {
        const updateData: Partial<MediaEntity> = {
          size: imageBuffer.length, // File size in bytes
          updatedAt: new Date().toISOString(),
        };

        await DynamoDBService.updateMedia(mediaId, updateData);
        console.log(
          `Successfully updated media entity ${mediaId} with URL, size (${imageBuffer.length} bytes), and dimensions`
        );
      } catch (dbError) {
        console.error(`Failed to update media entity ${mediaId}:`, dbError);
        // Don't throw here - the upload was successful, DB update is secondary
      }

      return result.publicUrl;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const isTimeout =
        (error as any)?.code === "ECONNABORTED" ||
        (error instanceof Error && error.message.includes("timeout"));
      const isNetworkError =
        (error as any)?.code === "ENOTFOUND" ||
        (error as any)?.code === "ECONNREFUSED" ||
        (error instanceof Error && error.message.includes("network"));
      const isServerError = (error as any)?.response?.status >= 500;

      console.error(
        `Download attempt ${attempt + 1} failed for ${image.filename}:`,
        {
          message: lastError.message,
          code: (error as any)?.code,
          status: (error as any)?.response?.status,
          isTimeout,
          isNetworkError,
          isServerError,
        }
      );

      // Don't retry on client errors (4xx) except 408, 429
      if (
        (error as any)?.response?.status >= 400 &&
        (error as any)?.response?.status < 500 &&
        (error as any)?.response?.status !== 408 &&
        (error as any)?.response?.status !== 429
      ) {
        console.error(
          `Non-retryable client error ${
            (error as any)?.response?.status
          }, not retrying`
        );
        break;
      }

      // If this was the last attempt, don't wait
      if (attempt === maxRetries - 1) {
        break;
      }

      // Wait before retry with progressive backoff
      const delay = retryDelays[attempt] || 5000;
      console.log(`Waiting ${delay}ms before retry...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // All attempts failed, handle the error
  console.error(
    `All ${maxRetries} download attempts failed for ${image.filename}`
  );

  const isTimeout =
    lastError &&
    ((lastError as any).code === "ECONNABORTED" ||
      lastError.message.includes("timeout"));

  // Update queue entry status to failed
  try {
    await queueService.updateQueueEntry(queueEntry.queueId, {
      status: "failed",
      errorMessage: isTimeout
        ? `Image download timeout after ${maxRetries} attempts: ${lastError?.message}`
        : `Image download failed after ${maxRetries} attempts: ${lastError?.message}`,
      completedAt: Date.now().toString(),
    });
    console.log(
      `Updated queue entry ${queueEntry.queueId} status to failed due to ${
        isTimeout ? "timeout" : "error"
      } after ${maxRetries} attempts`
    );
  } catch (updateError) {
    console.error(`Failed to update queue entry status:`, updateError);
  }

  // Don't throw error, return null to allow processing of other images
  return null;
}

async function handleGetClientConnectionId(
  connectionId: string | null
): Promise<void> {
  if (!connectionId) {
    console.error("No connectionId available");
    return;
  }

  // Assuming you have a way to send messages back to the client
  const message = {
    type: "client_connectionId",
    connectionId,
  };

  await sendMessageToConnection(connectionId, message);
}

/**
 * Main function to handle generation completion from ComfyUI executed message
 * @param message - Raw ComfyUI executed websocket message
 * @param context - Generation context with queue and user information
 * @returns CompletionData object or null if no images
 */
export async function handleGenerationComplete(
  message: ComfyUIExecutedMessage
): Promise<void | null> {
  const { prompt_id, node, output } = message.data;

  const queueEntry = await queueService.findQueueEntryByPromptId(prompt_id);

  // Check if this execution produced images
  const images = output.images || [];

  if (images.length === 0) {
    console.log(`Node ${node} executed but produced no images`);
    return null;
  }

  console.log(`Node ${node} produced ${images.length} image(s)`);

  if (queueEntry && images.length > 0) {
    const COMFYUI_ENDPOINT =
      await ParameterStoreService.getComfyUIApiEndpoint();

    // Create Media entities in DynamoDB FIRST before uploading to S3
    const createdMediaEntities = await createMediaEntitiesFirst(
      queueEntry,
      images
    );

    if (createdMediaEntities.length === 0) {
      throw new Error("Failed to create any media entities in DynamoDB");
    }

    console.log(
      `Created ${createdMediaEntities.length} media entities in DynamoDB`
    );

    // Update queue entry with completion status
    try {
      // Convert MediaEntities to Media objects for response
      const mediaObjects: Media[] = createdMediaEntities.map((mediaEntity) =>
        DynamoDBService.convertMediaEntityToMedia(mediaEntity)
      );

      console.log(
        `Using ${mediaObjects.length} already-created Media entities for job completion`
      );

      // Download and upload images to S3 using predictable filenames
      const uploadedImageUrls: string[] = [];

      for (let index = 0; index < images.length; index++) {
        const image = images[index];
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
        await queueService.updateQueueEntry(queueEntry.queueId, {
          status: "failed",
          errorMessage: "Failed to upload any generated images",
          completedAt: Date.now().toString(),
        });
        if (WEBSOCKET_ENDPOINT && queueEntry.connectionId) {
          const failureMessage = {
            type: "failed",
            queueId: queueEntry.queueId,
            promptId: queueEntry.comfyPromptId,
            timestamp: new Date().toISOString(),
            status: "failed",
            message: "Generation failed",
            error: "Failed to upload any generated images",
          };

          await sendMessageToConnection(
            queueEntry.connectionId,
            failureMessage
          );
        }
        throw new Error("Failed to upload any generated images");
      }

      console.log(`Successfully uploaded ${uploadedImageUrls.length} images`);

      // Update queue entry with completion status
      await queueService.updateQueueEntry(queueEntry.queueId, {
        status: "completed",
        resultImageUrl: uploadedImageUrls[0] || undefined, // Primary image URL
        completedAt: Date.now().toString(),
      });

      console.log(
        `Updated queue entry ${queueEntry.queueId} status to completed`
      );

      // Broadcast completion to connected WebSocket clients
      if (WEBSOCKET_ENDPOINT && queueEntry.connectionId) {
        const message = {
          type: "completed",
          queueId: queueEntry.queueId,
          promptId: queueEntry.comfyPromptId,
          timestamp: new Date().toISOString(),
          status: "completed",
          message: "Generation completed successfully!",
          medias: mediaObjects,
        };

        await sendMessageToConnection(queueEntry.connectionId, message);
      }
    } catch (error) {
      console.error("Error handling job completion:", error);
      throw error;
    }
  } else {
    console.log(`Node ${node} executed but produced no images`);
    return null;
  }
}

/**
 * Check if a ComfyUI executed message contains images
 */
export function hasGeneratedImages(message: ComfyUIExecutedMessage): boolean {
  return !!(
    message.data.output.images && message.data.output.images.length > 0
  );
}

/**
 * Extract image references from ComfyUI executed message
 * Useful for downloading images from ComfyUI server
 */
export function extractImageReferences(
  message: ComfyUIExecutedMessage,
  comfyuiEndpoint: string
): Array<{ url: string; image: ComfyUIImage; index: number }> {
  const images = message.data.output.images || [];

  return images.map((image, index) => ({
    url: `${comfyuiEndpoint}/view?filename=${encodeURIComponent(
      image.filename
    )}&subfolder=${encodeURIComponent(
      image.subfolder
    )}&type=${encodeURIComponent(image.type)}`,
    image,
    index,
  }));
}

/**
 * Format node name for better display
 */
function formatNodeName(displayNodeId: string, nodeTitle?: string): string {
  // Use nodeTitle if available, otherwise format displayNodeId
  if (nodeTitle && nodeTitle !== displayNodeId) {
    return nodeTitle;
  }

  // Convert node IDs like "KSampler" to "K-Sampler" for better readability
  return displayNodeId
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * Create intelligent progress message based on node state and progress
 */
function formatProgressMessage(
  displayNodeId: string,
  progress: number,
  maxProgress: number,
  percentage: number,
  state: string,
  nodeTitle?: string
): string {
  const finalNodeTitle = nodeTitle || displayNodeId;

  // Create different messages based on node type and state
  if (displayNodeId.toLowerCase().includes("sampler")) {
    return `Generating image using ${finalNodeTitle}: ${progress}/${maxProgress} steps (${percentage}%)`;
  } else if (displayNodeId.toLowerCase().includes("load")) {
    return `Loading ${finalNodeTitle}: ${percentage}%`;
  } else if (displayNodeId.toLowerCase().includes("encode")) {
    return `Encoding with ${finalNodeTitle}: ${progress}/${maxProgress} (${percentage}%)`;
  } else if (displayNodeId.toLowerCase().includes("decode")) {
    return `Decoding with ${finalNodeTitle}: ${progress}/${maxProgress} (${percentage}%)`;
  } else if (displayNodeId.toLowerCase().includes("vae")) {
    return `Processing with VAE: ${progress}/${maxProgress} (${percentage}%)`;
  } else {
    return `${finalNodeTitle}: ${progress}/${maxProgress} (${percentage}%) - ${state}`;
  }
}

/**
 * Transform ComfyUI progress_state websocket message to progressData format
 * @param message - The raw ComfyUI websocket message
 * @param nodeTitle - Optional node title from external source (e.g., workflow metadata)
 * @returns Array of ProgressData objects (one per active node)
 */
export function transformComfyUIProgressToProgressData(
  message: ComfyUIProgressState,
  nodeTitles?: Record<string, string>
): ProgressData[] {
  const { prompt_id, nodes } = message.data;
  const progressDataArray: ProgressData[] = [];

  if (!prompt_id || !nodes || Object.keys(nodes).length === 0) {
    return progressDataArray;
  }

  // Transform each node in the progress state
  for (const [nodeId, nodeInfo] of Object.entries(nodes)) {
    const value = nodeInfo.value || 0;
    const max = nodeInfo.max || 1;
    const percentage =
      max > 0 ? Math.round((value / max) * 100 * 100) / 100 : 0; // Round to 2 decimals
    const displayNodeId = nodeInfo.display_node_id || nodeId;
    const nodeTitle = nodeTitles?.[nodeId] || displayNodeId;

    const progressData: ProgressData = {
      nodeId,
      displayNodeId,
      currentNode: displayNodeId,
      nodeName: formatNodeName(displayNodeId, nodeTitle),
      value,
      max,
      percentage,
      nodeState: nodeInfo.state || "unknown",
      parentNodeId: nodeInfo.parent_node_id,
      realNodeId: nodeInfo.real_node_id || nodeId,
      nodeTitle,
      message: formatProgressMessage(
        displayNodeId,
        value,
        max,
        percentage,
        nodeInfo.state || "unknown",
        nodeTitle
      ),
    };

    progressDataArray.push(progressData);
  }

  return progressDataArray;
}

/**
 * Get the most relevant progress data from multiple nodes
 * (typically the one that's currently running)
 */
export function getMostRelevantProgress(
  progressDataArray: ProgressData[]
): ProgressData | undefined {
  if (progressDataArray.length === 0) {
    return undefined;
  }

  // Prioritize running nodes
  const runningNode = progressDataArray.find((p) => p.nodeState === "running");
  if (runningNode) {
    return runningNode;
  }

  // Otherwise return the first node
  return progressDataArray[0];
}

async function handleProgressState(
  message: ComfyUIProgressState
): Promise<void> {
  const progressDataArray = transformComfyUIProgressToProgressData(message);
  const mostRelevantProgress = getMostRelevantProgress(progressDataArray);

  if (mostRelevantProgress) {
    // Clean up expired cache entries periodically (every few calls)
    if (Math.random() < 0.1) {
      // 10% chance to trigger cleanup
      cleanupExpiredCache();
    }

    const queueEntry = await getQueueEntryWithCache(message.data.prompt_id);

    if (queueEntry) {
      const data = {
        type: "job_progress",
        queueId: queueEntry.queueId,
        promptId: queueEntry.comfyPromptId,
        timestamp: new Date().toISOString(),
        status: "processing",
        progressType: "node_progress",
        progressData: mostRelevantProgress,
      };

      if (queueEntry.connectionId) {
        await sendMessageToConnection(queueEntry.connectionId, data);
      } else {
        console.warn(`No connection found for queue ${queueEntry.queueId}`);
      }
    } else {
      console.warn(`No queue entry found for prompt ${message.data.prompt_id}`);
    }
  } else {
    console.warn(
      `No relevant progress found for prompt ${message.data.prompt_id}`
    );
  }
}

/**
 * Handle subscription to generation updates
 */
async function handleSubscribe(
  connectionId: string,
  message: WebSocketMessage
): Promise<void> {
  try {
    const { queueId } = message.data || {};

    if (!queueId) {
      await sendErrorToConnection(
        connectionId,
        "queueId is required for subscription",
        message.requestId
      );
      return;
    }

    // Verify connection exists
    const getConnectionResult = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `CONNECTION#${connectionId}`,
          SK: "METADATA",
        },
      })
    );

    if (!getConnectionResult.Item) {
      await sendErrorToConnection(
        connectionId,
        "Connection not found",
        message.requestId
      );
      return;
    }

    // Verify queue entry exists
    const queueEntry = await queueService.getQueueEntry(queueId);
    if (!queueEntry) {
      await sendErrorToConnection(
        connectionId,
        "Queue entry not found",
        message.requestId
      );
      return;
    }

    // Update queue entry with connection ID
    await queueService.updateQueueEntry(queueId, {
      connectionId: connectionId,
    });

    // Send confirmation
    await sendMessageToConnection(connectionId, {
      type: "subscription_confirmed",
      queueId,
      requestId: message.requestId,
    });

    console.log(`✅ Subscribed connection ${connectionId} to queue ${queueId}`);
  } catch (error) {
    console.error(`❌ Subscribe error for ${connectionId}:`, error);
    await sendErrorToConnection(
      connectionId,
      "Subscription failed",
      message.requestId
    );
  }
}

/**
 * Handle unsubscription from generation updates
 */
async function handleUnsubscribe(
  connectionId: string,
  message: WebSocketMessage
): Promise<void> {
  try {
    const { queueId } = message.data || {};

    if (!queueId) {
      await sendErrorToConnection(
        connectionId,
        "queueId is required for unsubscription",
        message.requestId
      );
      return;
    }

    // Verify queue entry exists and connection matches
    const queueEntry = await queueService.getQueueEntry(queueId);
    if (!queueEntry) {
      await sendErrorToConnection(
        connectionId,
        "Queue entry not found",
        message.requestId
      );
      return;
    }

    // Only remove connection ID if it matches the current connection
    if (queueEntry.connectionId === connectionId) {
      await queueService.updateQueueEntry(queueId, {
        connectionId: undefined,
      });
    }

    // Send confirmation
    await sendMessageToConnection(connectionId, {
      type: "unsubscription_confirmed",
      queueId,
      requestId: message.requestId,
    });

    console.log(
      `✅ Unsubscribed connection ${connectionId} from queue ${queueId}`
    );
  } catch (error) {
    console.error(`❌ Unsubscribe error for ${connectionId}:`, error);
    await sendErrorToConnection(
      connectionId,
      "Unsubscription failed",
      message.requestId
    );
  }
}

/**
 * Handle ping message for connection health check
 */
async function handlePing(
  connectionId: string,
  message: WebSocketMessage,
  event: APIGatewayProxyEvent
): Promise<void> {
  try {
    // Update last activity
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `CONNECTION#${connectionId}`,
          SK: "METADATA",
        },
        UpdateExpression: "SET lastActivity = :time",
        ExpressionAttributeValues: {
          ":time": new Date().toISOString(),
        },
      })
    );

    // Store visitor activity (max 1 per hour per IP)
    const clientIP = extractClientIP(event);
    const currentHour = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH format
    const visitorKey = `${currentHour}#${clientIP}`;

    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: "VISITOR",
          SK: visitorKey,
        },
        UpdateExpression:
          "SET #ts = if_not_exists(#ts, :time), #ip = :ip, #conn = :conn, #ls = :ls",
        ExpressionAttributeNames: {
          "#ts": "timestamp",
          "#ip": "clientIP",
          "#conn": "connectionId",
          "#ls": "lastSeen",
        },
        ExpressionAttributeValues: {
          ":time": new Date().toISOString(),
          ":ip": clientIP,
          ":conn": connectionId,
          ":ls": new Date().toISOString(),
        },
      })
    );

    // Send pong response
    await sendMessageToConnection(connectionId, {
      type: "pong",
      timestamp: new Date().toISOString(),
      requestId: message.requestId,
    });
  } catch (error) {
    console.error(`❌ Ping error for ${connectionId}:`, error);
  }
}

/**
 * Send a message to a WebSocket connection
 */
async function sendMessageToConnection(
  connectionId: string,
  data: any
): Promise<void> {
  try {
    const command = new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify(data),
    });

    await apiGatewayClient.send(command);
    console.log(
      `📤 Sent message to connection ${connectionId}:`,
      data.type || "unknown"
    );
  } catch (error: any) {
    console.error(`❌ Failed to send message to ${connectionId}:`, error);

    // If connection is gone, clean it up
    if (error.name === "GoneException") {
      console.log(`🧹 Cleaning up stale connection ${connectionId}`);
      try {
        await docClient.send(
          new DeleteCommand({
            TableName: TABLE_NAME,
            Key: {
              PK: `CONNECTION#${connectionId}`,
              SK: "METADATA",
            },
          })
        );

        // Clean up cache entries for this connection
        cleanupCacheByConnectionId(connectionId);
      } catch (cleanupError) {
        console.error(
          `❌ Failed to cleanup connection ${connectionId}:`,
          cleanupError
        );
      }
    }

    throw error;
  }
}

/**
 * Send an error message to a WebSocket connection
 */
async function sendErrorToConnection(
  connectionId: string,
  errorMessage: string,
  requestId?: string
): Promise<void> {
  try {
    await sendMessageToConnection(connectionId, {
      type: "error",
      error: errorMessage,
      requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`❌ Failed to send error to ${connectionId}:`, error);
  }
}

/**
 * Broadcast a message to the subscriber of a queue (using queue entry connectionId)
 */
export async function broadcastToQueueSubscribers(
  queueId: string,
  data: any
): Promise<void> {
  try {
    // Get the queue entry to find the connection ID
    const queueEntry = await queueService.getQueueEntry(queueId);

    if (!queueEntry || !queueEntry.connectionId) {
      console.log(`📭 No subscriber found for queue ${queueId}`);
      return;
    }

    // Send message to the subscriber
    try {
      await sendMessageToConnection(queueEntry.connectionId, {
        type: "generation_update",
        queueId,
        data,
        timestamp: new Date().toISOString(),
      });
      console.log(
        `📢 Broadcast message to subscriber ${queueEntry.connectionId} of queue ${queueId}`
      );
    } catch (error) {
      console.error(
        `❌ Failed to send to subscriber ${queueEntry.connectionId}:`,
        error
      );

      // If connection is gone, remove it from the queue entry
      if (
        error &&
        typeof error === "object" &&
        "name" in error &&
        error.name === "GoneException"
      ) {
        console.log(
          `🧹 Removing stale connection ${queueEntry.connectionId} from queue ${queueId}`
        );
        try {
          await queueService.updateQueueEntry(queueId, {
            connectionId: undefined,
          });
        } catch (cleanupError) {
          console.error(
            `❌ Failed to cleanup connection from queue ${queueId}:`,
            cleanupError
          );
        }
      }
    }
  } catch (error) {
    console.error(`❌ Failed to broadcast to queue ${queueId}:`, error);
    throw error;
  }
}

/**
 * Broadcast a message to all subscribers of a queue by looking up the queue from ComfyUI prompt ID
 * This is a helper function for compatibility with existing job handlers that use promptId
 */
export async function broadcastToQueueSubscribersByPromptId(
  promptId: string,
  data: any
): Promise<void> {
  try {
    // Find the queue entry by ComfyUI prompt ID
    const queueEntry = await queueService.findQueueEntryByPromptId(promptId);

    if (!queueEntry) {
      console.warn(`No queue entry found for prompt ID: ${promptId}`);
      return;
    }

    // Use the found queueId to broadcast to subscribers
    await broadcastToQueueSubscribers(queueEntry.queueId, data);
  } catch (error) {
    console.error(
      `❌ Failed to broadcast to queue subscribers by prompt ID ${promptId}:`,
      error
    );
    throw error;
  }
}
