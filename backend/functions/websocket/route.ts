/**
 * @fileoverview WebSocket Message Routing Handler
 * @description Routes WebSocket messages for subscriptions, progress updates, and generation completion handling.
 * @auth Connection-based (validates connection exists).
 * @body WebSocketMessage: { action: 'get_client_connectionId' | 'subscribe' | 'unsubscribe' | 'ping'; type: 'progress_state' | 'executed' }
 * @notes
 * - Handles actions: get_client_connectionId, subscribe, unsubscribe, ping.
 * - For ComfyUI messages: progress_state (updates progress), executed (handles generation complete, creates media entities, uploads to S3).
 * - Manages promptId cache for queue lookups.
 * - Broadcasts to subscribers on generation complete.
 * - Local cache TTL 5min for promptId to queueEntry.
 * - Cleans up cache on disconnect.
 * - Large file with helper functions for media creation, download/upload, progress transformation.
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
  Metadata,
  S3Service,
} from "@shared";
import {
  ComfyUIUploadCompleteMessage,
  UploadCompleteFailure,
  UploadCompleteImage,
} from "@shared";

import {
  createMediaEntity,
  createGenerationMetadata,
} from "@shared/utils/media-entity";

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

          case "upload_complete":
            await handleGenerationComplete(
              message as ComfyUIUploadCompleteMessage
            );
            break;

          case "executed":
            console.info(
              "ℹ️ Received executed message; awaiting upload_complete event"
            );
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

async function createMediaEntitiesFromUploads(
  queueEntry: QueueEntry,
  uploads: UploadCompleteImage[],
  batchCount: number
): Promise<{ entities: MediaEntity[]; failures: UploadCompleteFailure[] }> {
  const startTime = performance.now();

  if (uploads.length === 0) {
    return { entities: [], failures: [] };
  }

  const sortedUploads = [...uploads].sort((a, b) => {
    const indexA = a.index ?? uploads.indexOf(a);
    const indexB = b.index ?? uploads.indexOf(b);
    return indexA - indexB;
  });

  const parameters = queueEntry.parameters || {};
  const width = parameters.width || 1024;
  const height = parameters.height || 1024;

  const creationResults = await Promise.allSettled(
    sortedUploads.map(async (upload, position) => {
      const index = upload.index ?? position;
      const mediaId = `${queueEntry.queueId}_${index}`;
      const extension = inferFileExtension(upload);
      const mimeType = inferMimeType(upload);
      const relativePathCandidate = resolveRelativePath(upload);
      const objectKey = resolveObjectKey(
        queueEntry,
        upload,
        index,
        extension,
        relativePathCandidate
      );
      const relativePath =
        relativePathCandidate ?? S3Service.getRelativePath(objectKey);

      const generationMetadata = createGenerationMetadata({
        prompt: parameters.prompt || "Generated image",
        negativePrompt: parameters.negativePrompt || "",
        width,
        height,
        generationId: queueEntry.queueId,
        selectedLoras: parameters?.selectedLoras || [],
        batchCount,
        loraStrengths: parameters?.loraStrengths || {},
        loraSelectionMode: parameters?.loraSelectionMode,
        optimizePrompt: parameters?.optimizePrompt || false,
        cfgScale: parameters.cfg_scale || 4.5,
        steps: parameters.steps || 30,
        seed: parameters.seed || -1,
      });

      const mediaEntity = createMediaEntity({
        mediaId,
        userId: queueEntry.userId || "ANONYMOUS",
        filename: objectKey,
        originalFilename:
          upload.originalFilename ||
          queueEntry.filename ||
          `${mediaId}.${extension}`,
        mimeType,
        width,
        height,
        url: relativePath,
        metadata: generationMetadata,
        isPublic: parameters.isPublic,
        type: "image",
        size: upload.size,
      });

      await DynamoDBService.createMedia(mediaEntity);
      console.log(
        `✅ Created media entity ${mediaId} from uploaded image (index ${index})`
      );

      return { entity: mediaEntity, index };
    })
  );

  const entities: MediaEntity[] = [];
  const failures: UploadCompleteFailure[] = [];

  creationResults.forEach((result, position) => {
    if (result.status === "fulfilled") {
      entities.push(result.value.entity);
      return;
    }

    const upload = sortedUploads[position];
    const derivedIndex = upload?.index ?? position;
    const failure: UploadCompleteFailure = {
      index: derivedIndex,
      filename: upload?.originalFilename,
      error:
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason ?? "Unknown error"),
    };
    failures.push(failure);
    console.error(
      `❌ Failed to create media entity for queue ${queueEntry.queueId} index ${derivedIndex}:`,
      result.reason
    );
  });

  if (entities.length > 0 && queueEntry.userId) {
    try {
      await DynamoDBService.incrementUserProfileMetric(
        queueEntry.userId,
        "totalGeneratedMedias",
        entities.length
      );
      console.log(
        `📈 Incremented totalGeneratedMedias by ${entities.length} for user: ${queueEntry.userId}`
      );
    } catch (error) {
      console.warn(
        `⚠️ Failed to update user metrics for ${queueEntry.userId}:`,
        error
      );
    }
  }

  const entityCreationTime = performance.now() - startTime;
  console.log(
    `⚡ Created ${entities.length}/${
      uploads.length
    } media entities in ${entityCreationTime.toFixed(2)}ms`
  );

  return { entities, failures };
}

function inferFileExtension(upload: UploadCompleteImage): string {
  const mimeType = upload.mimeType?.toLowerCase();
  if (mimeType && mimeType.includes("/")) {
    const [, subtype] = mimeType.split("/");
    if (subtype) {
      if (subtype === "jpeg") {
        return "jpg";
      }
      const normalizedSubtype = (subtype.split("+")[0] || subtype).trim();
      return normalizedSubtype || "png";
    }
  }

  const candidates = [
    upload.originalFilename,
    upload.s3Key,
    upload.publicUrl,
    upload.relativePath,
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const match = candidate.toLowerCase().match(/\.([a-z0-9]+)(?:$|[?#])/);
    if (match && match[1]) {
      const ext = match[1];
      if (ext === "jpeg") {
        return "jpg";
      }
      return ext;
    }
  }

  return "png";
}

function inferMimeType(upload: UploadCompleteImage): string {
  if (upload.mimeType) {
    return upload.mimeType;
  }

  const extension = inferFileExtension(upload);

  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "bmp":
      return "image/bmp";
    case "tiff":
    case "tif":
      return "image/tiff";
    default:
      return `image/${extension || "png"}`;
  }
}

function resolveRelativePath(upload: UploadCompleteImage): string | undefined {
  if (upload.relativePath) {
    return upload.relativePath.startsWith("/")
      ? upload.relativePath
      : `/${upload.relativePath}`;
  }

  if (upload.s3Key) {
    return S3Service.getRelativePath(upload.s3Key);
  }

  if (upload.publicUrl) {
    const keyFromUrl = S3Service.extractKeyFromUrl(upload.publicUrl);
    if (keyFromUrl) {
      return S3Service.getRelativePath(keyFromUrl);
    }
  }

  return undefined;
}

function resolveObjectKey(
  queueEntry: QueueEntry,
  upload: UploadCompleteImage,
  index: number,
  extension: string,
  relativePath?: string
): string {
  if (upload.s3Key) {
    return upload.s3Key;
  }

  if (relativePath) {
    return relativePath.startsWith("/")
      ? relativePath.substring(1)
      : relativePath;
  }

  if (upload.publicUrl) {
    const keyFromUrl = S3Service.extractKeyFromUrl(upload.publicUrl);
    if (keyFromUrl) {
      return keyFromUrl;
    }
  }

  const cleanedExtension = extension || "png";
  return `generated/${queueEntry.queueId}/${queueEntry.queueId}_${index}.${cleanedExtension}`;
}

async function updateBulkSiblingMetadata(
  entities: MediaEntity[]
): Promise<void> {
  if (entities.length <= 1) {
    return;
  }

  const successfulIds = entities.map((entity) => entity.id);

  const updateResults = await Promise.allSettled(
    entities.map(async (entity) => {
      const siblingIds = successfulIds.filter((id) => id !== entity.id);
      const updatedMetadata: Metadata = {
        ...(entity.metadata || {}),
      };

      if (siblingIds.length > 0) {
        updatedMetadata["bulkSiblings"] = siblingIds;
      } else {
        delete updatedMetadata["bulkSiblings"];
      }

      const updatedAt = new Date().toISOString();

      await DynamoDBService.updateMedia(entity.id, {
        metadata: updatedMetadata,
        updatedAt,
      });
    })
  );

  updateResults.forEach((result, index) => {
    if (result.status === "rejected") {
      console.warn(
        `⚠️ Failed to update metadata for media ${entities[index]?.id}:`,
        result.reason
      );
    }
  });
}

function resolvePublicUrl(
  upload: UploadCompleteImage | undefined,
  mediaEntity: MediaEntity
): string | undefined {
  if (upload?.publicUrl) {
    return upload.publicUrl;
  }

  if (upload?.relativePath) {
    return S3Service.composePublicUrl(upload.relativePath);
  }

  if (upload?.s3Key) {
    return S3Service.composePublicUrl(S3Service.getRelativePath(upload.s3Key));
  }

  if (mediaEntity.url) {
    return S3Service.composePublicUrl(mediaEntity.url);
  }

  if (mediaEntity.filename) {
    return S3Service.composePublicUrl(
      S3Service.getRelativePath(mediaEntity.filename)
    );
  }

  return undefined;
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
 * Main function to handle generation completion from ComfyUI upload_complete message
 */
export async function handleGenerationComplete(
  message: ComfyUIUploadCompleteMessage
): Promise<void | null> {
  const startTime = performance.now();
  const data = message.data;

  if (!data) {
    console.warn("⚠️ upload_complete message missing data payload");
    return null;
  }

  const {
    prompt_id: promptId,
    node,
    uploaded_images: uploadedImagesRaw,
    failed_uploads: failedUploadsRaw,
    total_images: totalImages,
    status,
  } = data;

  if (!promptId) {
    console.warn("⚠️ upload_complete message missing prompt_id");
    return null;
  }

  const uploadedImages: UploadCompleteImage[] = [...(uploadedImagesRaw ?? [])];
  const failedUploads: UploadCompleteFailure[] = [...(failedUploadsRaw ?? [])];

  console.log(
    `📨 Received upload_complete message for prompt ${promptId} with ${uploadedImages.length} uploaded image(s)`
  );

  const queueEntry = await queueService.findQueueEntryByPromptId(promptId);

  if (!queueEntry) {
    console.warn(`⚠️ No queue entry found for prompt ID: ${promptId}`);
    return null;
  }

  const expectedBatchCount =
    totalImages ?? uploadedImages.length + failedUploads.length;

  if (uploadedImages.length === 0) {
    const errorMessage =
      status === "failed"
        ? "Generation failed: no images uploaded"
        : failedUploads.length > 0
        ? `Generation failed: ${failedUploads.length} upload(s) failed`
        : "Generation failed: no uploaded media provided";

    await queueService.updateQueueEntry(queueEntry.queueId, {
      status: "failed",
      errorMessage,
      completedAt: Date.now().toString(),
    });

    if (WEBSOCKET_ENDPOINT && queueEntry.connectionId) {
      await sendMessageToConnection(queueEntry.connectionId, {
        type: "failed",
        queueId: queueEntry.queueId,
        promptId: queueEntry.comfyPromptId,
        timestamp: new Date().toISOString(),
        status: "failed",
        message: errorMessage,
        error: errorMessage,
        failures: failedUploads,
      });
    }

    console.warn(
      `❌ upload_complete for prompt ${promptId} contained no successful uploads`
    );
    return null;
  }

  const { entities: createdEntities, failures: creationFailures } =
    await createMediaEntitiesFromUploads(
      queueEntry,
      uploadedImages,
      expectedBatchCount
    );

  if (creationFailures.length > 0) {
    failedUploads.push(...creationFailures);
  }

  if (createdEntities.length === 0) {
    const errorMessage = "Failed to persist uploaded media entities";

    await queueService.updateQueueEntry(queueEntry.queueId, {
      status: "failed",
      errorMessage,
      completedAt: Date.now().toString(),
    });

    if (WEBSOCKET_ENDPOINT && queueEntry.connectionId) {
      await sendMessageToConnection(queueEntry.connectionId, {
        type: "failed",
        queueId: queueEntry.queueId,
        promptId: queueEntry.comfyPromptId,
        timestamp: new Date().toISOString(),
        status: "failed",
        message: errorMessage,
        error: errorMessage,
        failures: failedUploads,
      });
    }

    console.warn(
      `❌ Failed to create any media entities for prompt ${promptId}`
    );
    return null;
  }

  await updateBulkSiblingMetadata(createdEntities);

  const mediaObjects: Media[] = createdEntities.map((mediaEntity) =>
    DynamoDBService.convertMediaEntityToMedia(mediaEntity)
  );

  const hadPartialFailures = failedUploads.length > 0;
  const completionMessage = hadPartialFailures
    ? "Generation completed with partial results"
    : "Generation completed successfully!";

  const primaryEntity = createdEntities[0]!;
  const primaryUpload = uploadedImages.find((upload) => {
    const index = upload.index ?? uploadedImages.indexOf(upload);
    const mediaId = `${queueEntry.queueId}_${index}`;
    return mediaId === primaryEntity.id;
  });

  const resultImageUrl = resolvePublicUrl(
    primaryUpload ?? uploadedImages[0],
    primaryEntity
  );

  await queueService.updateQueueEntry(queueEntry.queueId, {
    status: "completed",
    resultImageUrl,
    completedAt: Date.now().toString(),
  });

  if (WEBSOCKET_ENDPOINT && queueEntry.connectionId) {
    const websocketPayload: any = {
      type: "completed",
      queueId: queueEntry.queueId,
      promptId: queueEntry.comfyPromptId,
      timestamp: new Date().toISOString(),
      status: "completed",
      message: completionMessage,
      medias: mediaObjects,
    };

    if (hadPartialFailures) {
      websocketPayload.partialFailures = failedUploads;
    }

    await sendMessageToConnection(queueEntry.connectionId, websocketPayload);
  }

  const totalTime = performance.now() - startTime;
  console.log(
    `⚡ handleGenerationComplete processed upload_complete for prompt ${promptId} in ${totalTime.toFixed(
      2
    )}ms (created ${
      createdEntities.length
    }/${expectedBatchCount} media entities${node ? `; node=${node}` : ""})`
  );

  return null;
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
    const clientIP = event.requestContext.identity.sourceIp || "UNKNOWN_IP";
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
