import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { WorkflowFinalParams } from "@shared/shared-types";
import { v4 as uuidv4 } from "uuid";

export interface QueueEntry {
  queueId: string;
  userId: string;
  connectionId?: string;
  status: "pending" | "processing" | "completed" | "failed" | "timeout";
  prompt: string;
  parameters: WorkflowFinalParams;
  priority: number; // Lower number = higher priority (0 = highest)
  createdAt: string; // ISO 8601 string to match DynamoDB index type
  updatedAt: string; // ISO 8601 string for consistency
  startedAt?: string; // ISO 8601 string for consistency
  completedAt?: string; // ISO 8601 string for consistency
  estimatedWaitTime?: number;
  queuePosition?: number;
  comfyPromptId?: string;
  resultImageUrl?: string;
  errorMessage?: string;
  errorType?: string; // ComfyUI error type for better debugging
  retryCount?: number; // Number of retry attempts
  lastErrorMessage?: string; // Last error message for retry tracking
  timeoutAt: string; // ISO 8601 string for consistency
  workflowData?: string; // JSON string containing workflow nodes and execution order
  filename?: string;
}

export interface QueueStats {
  totalInQueue: number;
  processingCount: number;
  averageProcessingTime: number; // Average processing time per image (not per batch)
  estimatedWaitTime: number;
}

export class GenerationQueueService {
  private static instance: GenerationQueueService;
  private dynamoDB: DynamoDBDocumentClient;
  private tableName: string;

  private constructor() {
    const client = new DynamoDBClient({});
    this.dynamoDB = DynamoDBDocumentClient.from(client);
    this.tableName = process.env["DYNAMODB_TABLE"] || "dev-pornspot-media";
  }

  public static getInstance(): GenerationQueueService {
    if (!GenerationQueueService.instance) {
      GenerationQueueService.instance = new GenerationQueueService();
    }
    return GenerationQueueService.instance;
  }

  /**
   * Add a new generation request to the queue
   */
  async addToQueue(
    userId: string,
    prompt: string,
    parameters: QueueEntry["parameters"],
    connectionId?: string,
    priority: number = 1000 // Default priority for regular users
  ): Promise<QueueEntry> {
    const queueId = uuidv4();
    const now = new Date().toISOString();
    const timeoutDuration = 30 * 60 * 1000; // 30 minutes timeout
    const timeoutAt = new Date(Date.now() + timeoutDuration).toISOString();

    const queueEntry: QueueEntry = {
      queueId,
      userId,
      connectionId,
      status: "pending",
      prompt,
      parameters,
      priority,
      createdAt: now,
      updatedAt: now,
      timeoutAt,
    };

    // Calculate queue position and estimated wait time
    const stats = await this.getQueueStats();
    queueEntry.queuePosition = stats.totalInQueue + 1;

    // For initial estimate, we'll use a simplified calculation
    // The actual wait time will be more accurate when updateQueuePositions() is called
    const currentBatchSize = parameters.batch_size || 1;
    queueEntry.estimatedWaitTime =
      stats.totalInQueue * stats.averageProcessingTime * currentBatchSize;

    await this.dynamoDB.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: `QUEUE#${queueId}`,
          SK: `ENTRY`,
          GSI1PK: `QUEUE#STATUS#${queueEntry.status}`,
          GSI1SK: `PRIORITY#${priority.toString().padStart(10, "0")}#${now}`,
          GSI3PK: `QUEUE#USER#${userId}`,
          GSI3SK: `${queueEntry.status}#${now}#${queueId}`,
          ...queueEntry,
          TTL: Math.floor(new Date(queueEntry.timeoutAt).getTime() / 1000), // DynamoDB TTL in seconds
        },
      })
    );

    return queueEntry;
  }

  /**
   * Get the next pending item from the queue (highest priority first)
   */
  async getNextPendingItem(): Promise<QueueEntry | null> {
    const result = await this.dynamoDB.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :statusKey",
        ExpressionAttributeValues: {
          ":statusKey": "QUEUE#STATUS#pending",
        },
        ScanIndexForward: true, // Sort by priority (ascending)
        Limit: 1,
      })
    );

    if (!result.Items || result.Items.length === 0) {
      return null;
    }

    return result.Items[0] as QueueEntry;
  }

  /**
   * Update queue entry status
   */
  async updateQueueEntry(
    queueId: string,
    updates: Partial<QueueEntry>
  ): Promise<void> {
    const now = new Date().toISOString();
    updates.updatedAt = now;

    // Get current entry to update GSI indexes properly
    let currentEntry: QueueEntry | null = null;
    if (updates.status || updates.comfyPromptId) {
      currentEntry = await this.getQueueEntry(queueId);
      if (!currentEntry) {
        throw new Error(`Queue entry ${queueId} not found`);
      }
    }

    // Build update expression dynamically
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        updateExpressions.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = value;
      }
    });

    // Update GSI1PK if status is being changed
    if (updates.status) {
      updateExpressions.push(`GSI1PK = :gsi1pk`);
      expressionAttributeValues[":gsi1pk"] = `QUEUE#STATUS#${updates.status}`;
    }

    // Update GSI2 if comfyPromptId is being set
    if (updates.comfyPromptId && currentEntry) {
      updateExpressions.push(`GSI2PK = :gsi2pk`, `GSI2SK = :gsi2sk`);
      expressionAttributeValues[":gsi2pk"] = "QUEUE#COMFY_PROMPT_ID";
      expressionAttributeValues[":gsi2sk"] = updates.comfyPromptId;
    }

    // Update GSI3SK if status is being changed (to maintain sort order with new status)
    if (updates.status && currentEntry) {
      updateExpressions.push(`GSI3SK = :gsi3sk`);
      expressionAttributeValues[
        ":gsi3sk"
      ] = `${updates.status}#${currentEntry.createdAt}#${queueId}`;
    }

    if (updateExpressions.length === 0) {
      return;
    }

    await this.dynamoDB.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `QUEUE#${queueId}`,
          SK: "ENTRY",
        },
        UpdateExpression: `SET ${updateExpressions.join(", ")}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );
  }

  /**
   * Get queue entry by ID
   */
  async getQueueEntry(queueId: string): Promise<QueueEntry | null> {
    const result = await this.dynamoDB.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk AND SK = :sk",
        ExpressionAttributeValues: {
          ":pk": `QUEUE#${queueId}`,
          ":sk": "ENTRY",
        },
      })
    );

    if (!result.Items || result.Items.length === 0) {
      return null;
    }

    return result.Items[0] as QueueEntry;
  }

  /**
   * Remove completed or failed entries from queue
   */
  async removeQueueEntry(queueId: string): Promise<void> {
    await this.dynamoDB.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: `QUEUE#${queueId}`,
          SK: "ENTRY",
        },
      })
    );
  }

  /**
   * Get queue statistics
   *
   * This method calculates batch-aware processing times by:
   * - Analyzing recent completed generations
   * - Dividing total processing time by batch size to get per-image processing time
   * - Providing more accurate wait time estimates based on actual image generation counts
   */
  async getQueueStats(): Promise<QueueStats> {
    // Get pending count
    const pendingResult = await this.dynamoDB.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :statusKey",
        ExpressionAttributeValues: {
          ":statusKey": "QUEUE#STATUS#pending",
        },
        Select: "COUNT",
      })
    );

    // Get processing count
    const processingResult = await this.dynamoDB.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :statusKey",
        ExpressionAttributeValues: {
          ":statusKey": "QUEUE#STATUS#processing",
        },
        Select: "COUNT",
      })
    );

    // Get recently completed items to calculate average processing time
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

    const completedResult = await this.dynamoDB.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :statusKey",
        FilterExpression: "completedAt > :oneHourAgo",
        ExpressionAttributeValues: {
          ":statusKey": "QUEUE#STATUS#completed",
          ":oneHourAgo": oneHourAgo,
        },
        Limit: 50, // Sample recent completions
      })
    );

    const totalInQueue = pendingResult.Count || 0;
    const processingCount = processingResult.Count || 0;

    // Calculate average processing time from completed items
    let averageProcessingTime = 120000; // Default 2 minutes
    if (completedResult.Items && completedResult.Items.length > 0) {
      const processingTimes = completedResult.Items.filter(
        (item) => item["startedAt"] && item["completedAt"] && item["parameters"]
      ).map((item) => {
        const startedAt = new Date(item["startedAt"] as string).getTime();
        const completedAt = new Date(item["completedAt"] as string).getTime();
        const totalProcessingTime = completedAt - startedAt;

        // Get batch size from parameters to calculate per-image processing time
        const batchSize = (item["parameters"] as any)?.batch_size || 1;
        const perImageProcessingTime = totalProcessingTime / batchSize;

        return perImageProcessingTime;
      });

      if (processingTimes.length > 0) {
        averageProcessingTime =
          processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
      }
    }

    // Estimate wait time based on queue position and processing time
    // For a more accurate estimate, we should consider the batch sizes of items ahead in queue
    // However, for simplicity, we'll use the total queue count multiplied by average processing time
    const estimatedWaitTime = totalInQueue * averageProcessingTime;

    return {
      totalInQueue,
      processingCount,
      averageProcessingTime,
      estimatedWaitTime,
    };
  }

  /**
   * Find queue entry by ComfyUI prompt ID
   */
  async findQueueEntryByPromptId(promptId: string): Promise<QueueEntry | null> {
    const result = await this.dynamoDB.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "GSI2",
        KeyConditionExpression: "GSI2PK = :gsi2pk AND GSI2SK = :gsi2sk",
        ExpressionAttributeValues: {
          ":gsi2pk": "QUEUE#COMFY_PROMPT_ID",
          ":gsi2sk": promptId,
        },
        Limit: 1,
      })
    );

    if (!result.Items || result.Items.length === 0) {
      return null;
    }

    return result.Items[0] as QueueEntry;
  }

  /**
   * Get user's queue entries
   */
  async getUserQueueEntries(userId: string): Promise<QueueEntry[]> {
    const result = await this.dynamoDB.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "GSI3",
        KeyConditionExpression: "GSI3PK = :gsi3pk",
        ExpressionAttributeValues: {
          ":gsi3pk": `QUEUE#USER#${userId}`,
        },
        ScanIndexForward: false, // Most recent first (newest status changes first)
      })
    );

    return (result.Items || []) as QueueEntry[];
  }

  /**
   * Update queue positions for all pending entries
   *
   * This method provides accurate wait time estimates by:
   * - Considering the batch size of each item ahead in the queue
   * - Calculating cumulative image count for more precise time estimates
   * - Accounting for the fact that 8-image batches take ~8x longer than 1-image batches
   */
  async updateQueuePositions(): Promise<void> {
    const pendingResult = await this.dynamoDB.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :statusKey",
        ExpressionAttributeValues: {
          ":statusKey": "QUEUE#STATUS#pending",
        },
        ScanIndexForward: true,
      })
    );

    if (!pendingResult.Items || pendingResult.Items.length === 0) {
      return;
    }

    const stats = await this.getQueueStats();

    // Update positions for all pending items with more accurate wait time estimation
    let cumulativeImageCount = 0;

    for (let i = 0; i < pendingResult.Items.length; i++) {
      const item = pendingResult.Items[i] as QueueEntry;
      const position = i + 1;

      // Calculate estimated wait time based on cumulative image count ahead in queue
      const batchSize = item.parameters?.batch_size || 1;
      const estimatedWaitTime =
        cumulativeImageCount * stats.averageProcessingTime;

      await this.updateQueueEntry(item.queueId, {
        queuePosition: position,
        estimatedWaitTime,
      });

      // Add this item's batch size to cumulative count for next items
      cumulativeImageCount += batchSize;
    }
  }

  /**
   * Get all pending queue entries
   */
  async getPendingQueueEntries(): Promise<QueueEntry[]> {
    const pendingResult = await this.dynamoDB.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :statusKey",
        ExpressionAttributeValues: {
          ":statusKey": "QUEUE#STATUS#pending",
        },
        ScanIndexForward: true,
      })
    );

    if (!pendingResult.Items || pendingResult.Items.length === 0) {
      return [];
    }

    return pendingResult.Items as QueueEntry[];
  }

  /**
   * Clean up timed out entries
   */
  async cleanupTimeoutEntries(): Promise<void> {
    const now = new Date().toISOString();

    // Find processing entries that have timed out
    const processingResult = await this.dynamoDB.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :statusKey",
        FilterExpression: "timeoutAt < :now",
        ExpressionAttributeValues: {
          ":statusKey": "QUEUE#STATUS#processing",
          ":now": now,
        },
      })
    );

    if (processingResult.Items) {
      for (const item of processingResult.Items) {
        await this.updateQueueEntry(item["queueId"], {
          status: "timeout",
          errorMessage: "Generation request timed out",
        });
      }
    }

    // Find pending entries that have timed out
    const pendingResult = await this.dynamoDB.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :statusKey",
        FilterExpression: "timeoutAt < :now",
        ExpressionAttributeValues: {
          ":statusKey": "QUEUE#STATUS#pending",
          ":now": now,
        },
      })
    );

    if (pendingResult.Items) {
      for (const item of pendingResult.Items) {
        await this.updateQueueEntry(item["queueId"], {
          status: "timeout",
          errorMessage: "Generation request timed out while waiting in queue",
        });
      }
    }
  }
}
