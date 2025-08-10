import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  DeleteCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

export interface QueueEntry {
  queueId: string;
  userId: string;
  connectionId?: string;
  status: "pending" | "processing" | "completed" | "failed" | "timeout";
  prompt: string;
  parameters: {
    width: number;
    height: number;
    steps: number;
    cfg_scale: number;
    seed?: number;
    batch_size?: number;
  };
  priority: number; // Lower number = higher priority (0 = highest)
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
  estimatedWaitTime?: number;
  queuePosition?: number;
  comfyPromptId?: string;
  resultImageUrl?: string;
  errorMessage?: string;
  errorType?: string; // ComfyUI error type for better debugging
  retryCount?: number; // Number of retry attempts
  lastErrorMessage?: string; // Last error message for retry tracking
  timeoutAt: number; // TTL timestamp
}

export interface QueueStats {
  totalInQueue: number;
  processingCount: number;
  averageProcessingTime: number;
  estimatedWaitTime: number;
}

export class GenerationQueueService {
  private static instance: GenerationQueueService;
  private dynamoDB: DynamoDBDocumentClient;
  private tableName: string;

  private constructor() {
    const client = new DynamoDBClient({});
    this.dynamoDB = DynamoDBDocumentClient.from(client);
    this.tableName = process.env["DYNAMODB_TABLE_NAME"] || "pornspot-media";
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
    const now = Date.now();
    const timeoutDuration = 30 * 60 * 1000; // 30 minutes timeout

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
      timeoutAt: now + timeoutDuration,
    };

    // Calculate queue position and estimated wait time
    const stats = await this.getQueueStats();
    queueEntry.queuePosition = stats.totalInQueue + 1;
    queueEntry.estimatedWaitTime = stats.estimatedWaitTime;

    await this.dynamoDB.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: `QUEUE#${queueId}`,
          SK: `ENTRY`,
          GSI1PK: `QUEUE#STATUS#${queueEntry.status}`,
          GSI1SK: `PRIORITY#${priority.toString().padStart(10, "0")}#${now}`,
          ...queueEntry,
          TTL: Math.floor(queueEntry.timeoutAt / 1000), // DynamoDB TTL in seconds
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
    const now = Date.now();
    updates.updatedAt = now;

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
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

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
        (item) => item["startedAt"] && item["completedAt"]
      ).map(
        (item) =>
          (item["completedAt"] as number) - (item["startedAt"] as number)
      );

      if (processingTimes.length > 0) {
        averageProcessingTime =
          processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
      }
    }

    // Estimate wait time based on queue position and processing time
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
    // Use scan operation to find by comfyPromptId
    // Note: In production, consider adding a GSI for better performance
    const result = await this.dynamoDB.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression:
          "begins_with(PK, :pkPrefix) AND comfyPromptId = :promptId",
        ExpressionAttributeValues: {
          ":pkPrefix": "QUEUE#",
          ":promptId": promptId,
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
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: "begins_with(PK, :queuePrefix) AND userId = :userId",
        ExpressionAttributeValues: {
          ":queuePrefix": "QUEUE#",
          ":userId": userId,
        },
      })
    );

    return (result.Items || []) as QueueEntry[];
  }

  /**
   * Update queue positions for all pending entries
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

    // Update positions for all pending items
    for (let i = 0; i < pendingResult.Items.length; i++) {
      const item = pendingResult.Items[i] as QueueEntry;
      const position = i + 1;
      const estimatedWaitTime = position * stats.averageProcessingTime;

      await this.updateQueueEntry(item.queueId, {
        queuePosition: position,
        estimatedWaitTime,
      });
    }
  }

  /**
   * Clean up timed out entries
   */
  async cleanupTimeoutEntries(): Promise<void> {
    const now = Date.now();

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
