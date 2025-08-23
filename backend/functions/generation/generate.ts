/*
 * File objective: Generate AI images based on a prompt, enforcing plan-based limits and features.
 * Auth: Requires user session via LambdaHandlerUtil.withAuth.
 *
 * Key responsibilities:
 * - Validates prompt and optional parameters (negative prompt, size, batch, LoRAs)
 * - Enforces plan permissions (max batch, LoRA usage, negative prompts, custom sizes)
 * - Manages generation queue with priority based on user plan
 * - Handles prompt optimization and moderation via streaming
 * - Returns metadata including queueId and estimated wait time
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { PlanUtil } from "@shared/utils/plan";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";
import { getGenerationPermissions } from "@shared/utils/permissions";
import { getRateLimitingService } from "@shared/services/rate-limiting";
import {
  GenerationQueueService,
  QueueEntry,
} from "@shared/services/generation-queue";
import { OpenRouterService } from "@shared/services/openrouter-chat";
import {
  createComfyUIWorkflow,
  DEFAULT_WORKFLOW_PARAMS,
  WorkflowParameters,
} from "@shared/templates/comfyui-workflow";
import { createWorkflowData } from "@shared/utils/workflow-nodes";
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import type {
  GenerationResponse,
  GenerationRequest,
  WorkflowFinalParams,
  WorkflowData,
  User,
} from "@shared/shared-types";
import { ParameterStoreService } from "@shared/utils/parameters";
import {
  getComfyUIClient,
  initializeComfyUIClient,
} from "@shared/services/comfyui-client";
import {
  ComfyUIError,
  ComfyUIErrorType,
  ComfyUIRetryHandler,
} from "@shared/services/comfyui-error-handler";

// ====================================
// Performance Monitoring
// ====================================

class PerformanceTimer {
  private startTime: number;
  private label: string;

  constructor(label: string) {
    this.label = label;
    this.startTime = performance.now();
    console.log(`[PERFORMANCE] ${this.label} - Started`);
  }

  end(): number {
    const elapsed = performance.now() - this.startTime;
    console.log(
      `[PERFORMANCE] ${this.label} - Completed in ${elapsed.toFixed(2)}ms`
    );
    return elapsed;
  }

  checkpoint(checkpointLabel: string): number {
    const elapsed = performance.now() - this.startTime;
    console.log(
      `[PERFORMANCE] ${this.label} - ${checkpointLabel}: ${elapsed.toFixed(
        2
      )}ms`
    );
    return elapsed;
  }
}

// ====================================
// Constants and Configuration
// ====================================

const CONFIG = {
  PLAN_LIMITS: {
    free: { monthly: 30, daily: 1, priority: 1000 },
    starter: { monthly: 300, daily: 50, priority: 500 },
    pro: { monthly: "unlimited", daily: "unlimited", priority: 100 },
    unlimited: { monthly: "unlimited", daily: "unlimited", priority: 0 },
  },
  VALIDATION_LIMITS: {
    prompt: { maxLength: 1000 },
    negativePrompt: { maxLength: 500 },
  },
  MODELS: {
    moderation: "mistralai/mistral-medium-3.1",
    optimization: "mistralai/mistral-medium-3.1",
    loraSelection: "mistralai/mistral-medium-3.1",
  },
  AI_PARAMS: {
    temperature: {
      moderation: 0.1,
      optimization: 0.7,
      loraSelection: 0.1,
      titleGeneration: 0.7,
    },
    maxTokens: {
      moderation: 256,
      optimization: 1024,
      loraSelection: 512,
      titleGeneration: 128,
    },
  },
} as const;

const KEYWORDS_FOR_NEGATIVE_PROMPT = ["child", "teen"];

// Initialize AWS API Gateway client for WebSocket messaging
const apiGatewayClient = new ApiGatewayManagementApiClient({
  endpoint: process.env["WEBSOCKET_API_ENDPOINT"],
});

// ====================================
// Type Definitions
// ====================================

interface ValidationError {
  message: string;
  field?: string;
}

interface ProcessingResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ====================================
// WebSocket Communication Service
// ====================================

class WebSocketService {
  static async sendMessage(
    connectionId: string,
    messageType: string,
    data: any
  ): Promise<void> {
    if (!connectionId) return;

    try {
      const command = new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: JSON.stringify({
          type: messageType,
          ...data,
          timestamp: new Date().toISOString(),
        }),
      });

      await apiGatewayClient.send(command);
      console.log(
        `📤 Sent ${messageType} message to connection ${connectionId}`
      );
    } catch (error: any) {
      console.error(
        `❌ Failed to send ${messageType} message to ${connectionId}:`,
        error
      );

      // Don't throw error for gone connections to avoid disrupting generation
      if (error.name === "GoneException") {
        console.log(
          `🧹 Connection ${connectionId} is gone, skipping ${messageType} message`
        );
      }
    }
  }

  static async sendOptimizationMessage(
    connectionId: string,
    data: any
  ): Promise<void> {
    await this.sendMessage(connectionId, data.type, data);
  }

  static async sendWorkflowMessage(
    connectionId: string,
    workflow: WorkflowData
  ): Promise<void> {
    await this.sendMessage(connectionId, "workflow", {
      workflowData: workflow,
    });
  }
}

// ====================================
// AI Service Wrapper
// ====================================

class AIService {
  private static openRouterService = OpenRouterService.getInstance();

  static async chatCompletion(
    template: string,
    userMessage: string,
    temperature: number,
    maxTokens: number
  ): Promise<string> {
    const response = await this.openRouterService.chatCompletion({
      instructionTemplate: template,
      userMessage: userMessage.trim(),
      model: CONFIG.MODELS.optimization,
      parameters: {
        temperature,
        max_tokens: maxTokens,
      },
    });
    return response.content.trim();
  }

  static async chatCompletionStream(
    template: string,
    userMessage: string,
    temperature: number,
    maxTokens: number
  ): Promise<AsyncIterable<string>> {
    return await this.openRouterService.chatCompletionStream({
      instructionTemplate: template,
      userMessage: userMessage.trim(),
      model: CONFIG.MODELS.optimization,
      parameters: {
        temperature,
        max_tokens: maxTokens,
      },
    });
  }

  static async performTitleGeneration(
    prompt: string
  ): Promise<ProcessingResult<string>> {
    const timer = new PerformanceTimer("Title Generation");

    try {
      const content = await this.chatCompletion(
        "prompt-to-title",
        prompt,
        CONFIG.AI_PARAMS.temperature.titleGeneration,
        CONFIG.AI_PARAMS.maxTokens.titleGeneration
      );

      return { success: true, data: content };
    } catch (error) {
      console.error("❌ Title generation failed:", error);
      return { success: false, error: "Title generation failed" };
    } finally {
      timer.end();
    }
  }

  static async performModeration(
    prompt: string
  ): Promise<ProcessingResult<void>> {
    const timer = new PerformanceTimer("Moderation");

    try {
      const content = await this.chatCompletion(
        "prompt-moderation",
        prompt,
        CONFIG.AI_PARAMS.temperature.moderation,
        CONFIG.AI_PARAMS.maxTokens.moderation
      );

      if (content !== "OK") {
        const jsonMatch = content.match(
          /\{[^}]*"reason"\s*:\s*"([^"]+)"[^}]*\}/
        );
        const reason = jsonMatch?.[1] || "Content violates platform rules";

        console.log("❌ Prompt rejected by moderation:", reason);
        PromptProcessor.shouldReturnPrematurely = true;
        return { success: false, error: reason };
      }

      console.log("✅ Prompt passed moderation check");
      return { success: true };
    } catch (error) {
      console.error("❌ Moderation check failed:", error);
      return { success: false, error: "Moderation check failed" };
    } finally {
      timer.end();
    }
  }

  static async selectLoras(prompt: string): Promise<string[]> {
    const timer = new PerformanceTimer("LoRA Selection");

    try {
      const content = await this.chatCompletion(
        "loras-selection",
        prompt,
        CONFIG.AI_PARAMS.temperature.loraSelection,
        CONFIG.AI_PARAMS.maxTokens.loraSelection
      );

      return this.parseLoraResponse(content);
    } catch (error) {
      console.error("❌ LoRA selection failed:", error);
      return [];
    } finally {
      timer.end();
    }
  }

  private static parseLoraResponse(content: string): string[] {
    // Try to parse as JSON array first
    const arrayRegex = /\[\s*(?:"[^"]*"(?:\s*,\s*"[^"]*")*)\s*\]/;
    const arrayMatch = content.match(arrayRegex);

    if (arrayMatch) {
      try {
        const parsedArray = JSON.parse(arrayMatch[0]);
        if (Array.isArray(parsedArray)) {
          return parsedArray.filter((lora: any) => typeof lora === "string");
        }
      } catch (error) {
        console.log("Failed to parse array pattern");
      }
    }

    // Try to parse as JSON object
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed.filter((lora: any) => typeof lora === "string");
      } else if (parsed?.loras && Array.isArray(parsed.loras)) {
        return parsed.loras.filter((lora: any) => typeof lora === "string");
      }
    } catch (error) {
      // Fall back to comma-separated list
      return content
        .split(",")
        .map((lora) => lora.trim())
        .filter((lora) => lora.length > 0);
    }

    return [];
  }
}

// ====================================
// Validation Service
// ====================================

class ValidationService {
  static validateRequest(
    requestBody: GenerationRequest,
    permissions: any
  ): ValidationError | null {
    const validators = [
      this.validatePrompt,
      this.validateNegativePrompt,
      this.validateBatchCount,
      this.validateLoraUsage,
      this.validateImageSize,
      this.validatePrivateContent,
    ];

    for (const validator of validators) {
      const error = validator(requestBody, permissions);
      if (error) return error;
    }

    return null;
  }

  private static validatePrompt(
    requestBody: GenerationRequest,
    _permissions: any
  ): ValidationError | null {
    const { prompt } = requestBody;

    try {
      const validatedPrompt = ValidationUtil.validateRequiredString(
        prompt,
        "Prompt"
      );
      if (validatedPrompt.length > CONFIG.VALIDATION_LIMITS.prompt.maxLength) {
        return {
          message: `Prompt is too long (max ${CONFIG.VALIDATION_LIMITS.prompt.maxLength} characters)`,
          field: "prompt",
        };
      }
    } catch (error) {
      return { message: "Prompt is required", field: "prompt" };
    }

    return null;
  }

  private static validateNegativePrompt(
    requestBody: GenerationRequest,
    permissions: any
  ): ValidationError | null {
    const { negativePrompt = "" } = requestBody;

    if (
      negativePrompt &&
      negativePrompt.length > CONFIG.VALIDATION_LIMITS.negativePrompt.maxLength
    ) {
      return {
        message: `Negative prompt is too long (max ${CONFIG.VALIDATION_LIMITS.negativePrompt.maxLength} characters)`,
        field: "negativePrompt",
      };
    }

    if (negativePrompt?.trim() && !permissions.canUseNegativePrompt) {
      return {
        message: "Negative prompts require a Pro plan",
        field: "negativePrompt",
      };
    }

    return null;
  }

  private static validateBatchCount(
    requestBody: GenerationRequest,
    permissions: any
  ): ValidationError | null {
    const { batchCount = 1 } = requestBody;

    if (batchCount > 1 && !permissions.canUseBulkGeneration) {
      return {
        message: "Your plan allows maximum 1 image per batch",
        field: "batchCount",
      };
    }

    return null;
  }

  private static validateLoraUsage(
    requestBody: GenerationRequest,
    permissions: any
  ): ValidationError | null {
    const {
      selectedLoras = [],
      loraSelectionMode = "auto",
      loraStrengths = {},
    } = requestBody;

    const hasLoraUsage =
      selectedLoras.length > 0 ||
      loraSelectionMode !== "auto" ||
      Object.keys(loraStrengths).length > 0;

    if (hasLoraUsage && !permissions.canUseLoRAModels) {
      return { message: "LoRA models require a Pro plan", field: "lora" };
    }

    return null;
  }

  private static validateImageSize(
    requestBody: GenerationRequest,
    permissions: any
  ): ValidationError | null {
    const { imageSize = "1024x1024" } = requestBody;

    if (imageSize === "custom" && !permissions.canSelectImageSizes) {
      return {
        message: "Custom image sizes require Pro plan",
        field: "imageSize",
      };
    }

    return null;
  }

  private static validatePrivateContent(
    requestBody: GenerationRequest,
    permissions: any
  ): ValidationError | null {
    const { isPublic = true } = requestBody;

    if (!isPublic && !permissions.canCreatePrivateContent) {
      return {
        message: "Private content creation requires a Pro plan",
        field: "isPublic",
      };
    }

    return null;
  }
}

// ====================================
// Generation Service
// ====================================

class GenerationService {
  static calculateImageDimensions(
    imageSize: string,
    customWidth?: number,
    customHeight?: number
  ): { width: number; height: number } {
    if (imageSize === "custom") {
      return {
        width: customWidth || 1024,
        height: customHeight || 1024,
      };
    }

    const [widthStr, heightStr] = imageSize.split("x");
    return {
      width: parseInt(widthStr || "1024", 10),
      height: parseInt(heightStr || "1024", 10),
    };
  }

  static calculateUserPriority(userPlan: string): number {
    const planKey = userPlan.toLowerCase() as keyof typeof CONFIG.PLAN_LIMITS;
    return (
      CONFIG.PLAN_LIMITS[planKey]?.priority ?? CONFIG.PLAN_LIMITS.free.priority
    );
  }

  static createWorkflowParams(
    requestBody: GenerationRequest,
    finalPrompt: string
  ): WorkflowFinalParams {
    const {
      negativePrompt = DEFAULT_WORKFLOW_PARAMS.negativePrompt!,
      imageSize = "1024x1024",
      customWidth,
      customHeight,
      batchCount = 1,
      selectedLoras = [],
      loraSelectionMode = "auto",
      optimizePrompt = true,
    } = requestBody;

    const dimensions = this.calculateImageDimensions(
      imageSize,
      customWidth,
      customHeight
    );

    let loraStrengths: Record<
      string,
      { mode: "auto" | "manual"; value: number }
    > = requestBody.loraStrengths || {};

    if (loraSelectionMode === "auto") {
      loraStrengths = selectedLoras.reduce((acc, lora) => {
        acc[lora] = { mode: "auto", value: 1 };
        return acc;
      }, {} as Record<string, { mode: "auto"; value: number }>);
    }

    return {
      width: dimensions.width,
      height: dimensions.height,
      steps: 20,
      cfg_scale: 7.0,
      batch_size: batchCount,
      loraSelectionMode,
      loraStrengths,
      selectedLoras,
      optimizePrompt,
      prompt: finalPrompt,
      negativePrompt: negativePrompt?.trim(),
    };
  }

  static checkGenerationLimits(
    user: User,
    requestedCount: number
  ): { allowed: boolean; remaining: number | "unlimited" } {
    const planKey =
      user.planInfo.plan.toLowerCase() as keyof typeof CONFIG.PLAN_LIMITS;
    const limits = CONFIG.PLAN_LIMITS[planKey] ?? CONFIG.PLAN_LIMITS.free;
    const usage = user.usageStats;

    // Check monthly limit
    if (limits.monthly !== "unlimited") {
      const monthlyRemaining = limits.monthly - usage.imagesGeneratedThisMonth;
      if (monthlyRemaining < requestedCount) {
        return { allowed: false, remaining: monthlyRemaining };
      }
    }

    // Check daily limit
    if (limits.daily !== "unlimited") {
      const dailyRemaining = limits.daily - usage.imagesGeneratedToday;
      if (dailyRemaining < requestedCount) {
        return { allowed: false, remaining: dailyRemaining };
      }
      return { allowed: true, remaining: dailyRemaining };
    }

    return { allowed: true, remaining: "unlimited" };
  }

  static generateWorkflowData(params: WorkflowFinalParams): WorkflowData {
    try {
      const workflowParams = {
        prompt: params.prompt,
        negativePrompt:
          params.negativePrompt || DEFAULT_WORKFLOW_PARAMS.negativePrompt!,
        width: params.width,
        height: params.height,
        batchSize: params.batch_size,
        steps: params.steps || DEFAULT_WORKFLOW_PARAMS.steps!,
        cfgScale: params.cfg_scale || DEFAULT_WORKFLOW_PARAMS.cfgScale!,
        sampler: DEFAULT_WORKFLOW_PARAMS.sampler,
        scheduler: DEFAULT_WORKFLOW_PARAMS.scheduler,
        selectedLoras: params.selectedLoras.map((loraName, index) => ({
          id: `lora_${index}`,
          name: loraName,
          strength: params.loraStrengths[loraName]?.value || 1.0,
        })),
      };

      const workflow = createComfyUIWorkflow(workflowParams);
      return createWorkflowData(workflow);
    } catch (error) {
      console.error("Failed to generate workflow data:", error);
      return {
        nodes: [],
        totalNodes: 0,
        currentNodeIndex: 0,
        nodeOrder: [],
      };
    }
  }
}

// ====================================
// ComfyUI Submission
// ====================================

export const submitPrompt = async (queueId: string): Promise<void> => {
  const timer = new PerformanceTimer(`ComfyUI Submission - ${queueId}`);
  const queueService = GenerationQueueService.getInstance();

  try {
    const COMFYUI_ENDPOINT =
      await ParameterStoreService.getComfyUIApiEndpoint();

    const queueItem = await queueService.getQueueEntry(queueId);
    if (!queueItem) {
      console.error(`❌ Queue item not found: ${queueId}`);
      return;
    }

    if (queueItem.status !== "pending") {
      console.log(
        `⚠️  Queue item ${queueId} is not pending (status: ${queueItem.status})`
      );
      return;
    }

    await queueService.updateQueueEntry(queueId, {
      status: "processing",
      startedAt: Date.now().toString(),
    });

    // Initialize ComfyUI client
    let comfyUIClient;
    try {
      comfyUIClient = getComfyUIClient();
    } catch {
      comfyUIClient = initializeComfyUIClient(COMFYUI_ENDPOINT);
    }

    // Health check with retry
    const isHealthy = await ComfyUIRetryHandler.withRetry(
      () => comfyUIClient.healthCheck(),
      { maxRetries: 2, baseDelay: 2000 },
      { operationName: "healthCheck", promptId: queueId }
    );

    if (!isHealthy) {
      throw new ComfyUIError(
        ComfyUIErrorType.CONNECTION_FAILED,
        "ComfyUI service is not available",
        { promptId: queueId, retryable: true }
      );
    }

    // Create workflow parameters
    const workflowParams: WorkflowParameters = {
      prompt: queueItem.prompt,
      negativePrompt:
        queueItem.parameters.negativePrompt +
        ", " +
        KEYWORDS_FOR_NEGATIVE_PROMPT.join(", "),
      width: queueItem.parameters.width,
      height: queueItem.parameters.height,
      batchSize: queueItem.parameters.batch_size || 1,
      selectedLoras: createSelectedLorasArray(queueItem),
    };

    // Submit to ComfyUI
    const submitResult = await comfyUIClient.submitPrompt(
      workflowParams,
      "666" // Monitor client_id
    );

    await queueService.updateQueueEntry(queueId, {
      comfyPromptId: submitResult.promptId,
      status: "processing",
    });

    console.log(
      `✅ ComfyUI submission successful: promptId=${submitResult.promptId}, queueId=${queueId}`
    );
  } catch (error) {
    const comfyError =
      error instanceof ComfyUIError
        ? error
        : new ComfyUIError(
            ComfyUIErrorType.UNKNOWN_ERROR,
            error instanceof Error ? error.message : "Unknown error",
            { promptId: queueId }
          );

    console.error(
      `❌ Queue submission error for ${queueId}:`,
      comfyError.message
    );
  } finally {
    timer.end();
  }
};

function createSelectedLorasArray(queueItem: QueueEntry): Array<{
  id: string;
  name: string;
  strength: number;
}> {
  if (!Array.isArray(queueItem.parameters.selectedLoras)) {
    return [];
  }

  return queueItem.parameters.selectedLoras.map(
    (loraName: string, index: number) => {
      const loraConfig = queueItem.parameters.loraStrengths?.[loraName];
      const strength = loraConfig?.mode === "auto" ? 1 : loraConfig?.value || 1;

      return {
        id: `lora_${index}`,
        name: loraName,
        strength,
      };
    }
  );
}

class PromptProcessor {
  static shouldReturnPrematurely: boolean = false;

  static async setShouldReturnPrematurely(value: boolean) {
    PromptProcessor.shouldReturnPrematurely = value;
  }

  static async processPrompt(
    validatedPrompt: string,
    requestBody: GenerationRequest,
    connectionId: string | null,
    queueId: string,
    queueEntry: QueueEntry
  ): Promise<ProcessingResult<GenerationResponse>> {
    const timer = new PerformanceTimer("Unified Prompt Processing");
    const queueService = GenerationQueueService.getInstance();

    try {
      // Initialize optimization state
      if (requestBody.optimizePrompt && connectionId) {
        await WebSocketService.sendOptimizationMessage(connectionId, {
          type: "optimization_start",
          optimizationData: {
            originalPrompt: validatedPrompt.trim(),
            optimizedPrompt: "",
            completed: false,
          },
        });
      }

      // Perform all operations in parallel
      const [moderationResult, selectedLoras, optimizedPrompt] =
        await Promise.all([
          // Always perform moderation
          AIService.performModeration(validatedPrompt),

          // Conditionally perform LoRA selection
          requestBody.loraSelectionMode === "auto"
            ? AIService.selectLoras(validatedPrompt)
            : Promise.resolve(requestBody.selectedLoras || []),

          // Conditionally perform optimization
          requestBody.optimizePrompt && connectionId
            ? this.streamOptimization(validatedPrompt, connectionId)
            : Promise.resolve(null),
        ]);

      // Handle moderation failure
      if (!moderationResult.success) {
        await this.handleModerationFailure(
          connectionId,
          queueId,
          moderationResult.error || "Content violates platform rules"
        );
        return {
          success: false,
          error: moderationResult.error || "Content violates platform rules",
        };
      }

      // Update request with selected LoRAs
      requestBody.selectedLoras = selectedLoras;

      // Determine final prompt
      const finalPrompt = optimizedPrompt || validatedPrompt.trim();
      const hasOptimization = optimizedPrompt !== null;

      // Create workflow
      const workflowParams = GenerationService.createWorkflowParams(
        requestBody,
        finalPrompt
      );

      // Update queue entry
      await queueService.updateQueueEntry(queueId, {
        prompt: finalPrompt,
        parameters: workflowParams,
      });

      // Generate and send workflow data
      const workflowData =
        GenerationService.generateWorkflowData(workflowParams);
      if (connectionId) {
        await WebSocketService.sendWorkflowMessage(connectionId, workflowData);

        // Send optimization complete if we optimized
        if (hasOptimization) {
          await WebSocketService.sendOptimizationMessage(connectionId, {
            type: "optimization_complete",
            optimizationData: {
              originalPrompt: validatedPrompt.trim(),
              optimizedPrompt,
              completed: true,
            },
          });
        }
      }

      // Submit to ComfyUI
      await submitPrompt(queueId);

      // Generate title for the image
      const imageTitle = await AIService.performTitleGeneration(
        validatedPrompt
      );
      if (imageTitle.success && imageTitle.data) {
        await queueService.updateQueueEntry(queueId, {
          filename: imageTitle.data,
        });
        // Update filename in dynamodb
        await DynamoDBService.updateMediaAndSiblingsFilename(
          queueId,
          imageTitle.data
        );
      } else {
        console.warn("❗ Title generation failed:", imageTitle.error);
      }

      // Build response
      const response: GenerationResponse = {
        queueId,
        queuePosition: queueEntry.queuePosition || 1,
        estimatedWaitTime: queueEntry.estimatedWaitTime || 0,
        status: "pending",
        message: `Your request has been added to the queue${
          hasOptimization ? " with optimized prompt" : ""
        }. Position: ${queueEntry.queuePosition || 1}`,
        workflowData,
        ...(hasOptimization && { optimizedPrompt }),
      };

      return { success: true, data: response };
    } catch (error) {
      console.error("❌ Prompt processing failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Processing failed",
      };
    } finally {
      timer.end();
    }
  }

  private static async streamOptimization(
    prompt: string,
    connectionId: string
  ): Promise<string> {
    // Check if we should return prematurely before starting
    if (PromptProcessor.shouldReturnPrematurely) {
      console.log(
        "⚠️ Stream optimization interrupted - returning original prompt"
      );
      return prompt.trim();
    }

    const stream = await AIService.chatCompletionStream(
      "prompt-optimization",
      prompt,
      CONFIG.AI_PARAMS.temperature.optimization,
      CONFIG.AI_PARAMS.maxTokens.optimization
    );

    let optimizedPrompt = "";
    for await (const token of stream) {
      // Check if we should stop during streaming
      if (PromptProcessor.shouldReturnPrematurely) {
        console.log(
          "⚠️ Stream optimization interrupted during streaming - returning partial result"
        );
        break;
      }

      optimizedPrompt += token;
      await WebSocketService.sendOptimizationMessage(connectionId, {
        type: "optimization_token",
        optimizationData: {
          originalPrompt: prompt.trim(),
          optimizedPrompt,
          token,
          completed: false,
        },
      });
    }

    return optimizedPrompt.trim() || prompt.trim();
  }

  private static async handleModerationFailure(
    connectionId: string | null,
    queueId: string,
    reason: string
  ): Promise<void> {
    // Notify user if connected
    if (connectionId) {
      await WebSocketService.sendOptimizationMessage(connectionId, {
        type: "prompt-moderation",
        status: "refused",
        reason,
      });
    }

    // Clean up queue entry
    try {
      const queueService = GenerationQueueService.getInstance();
      await queueService.removeQueueEntry(queueId);
      console.log(
        `🗑️ Removed queue entry ${queueId} due to moderation failure`
      );
    } catch (error) {
      console.error("Failed to remove queue entry:", error);
    }
  }
}

// ====================================
// Simplified Main Handler
// ====================================

const handleGenerate = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  const timer = new PerformanceTimer("Generation Handler");

  // Validate HTTP method
  if (event.httpMethod !== "POST") {
    return ResponseUtil.badRequest(event, "Only POST method allowed");
  }

  // Parse request and fetch user
  const requestBody: GenerationRequest = LambdaHandlerUtil.parseJsonBody(event);
  const userEntity = await DynamoDBService.getUserById(auth.userId);

  if (!userEntity) {
    return ResponseUtil.notFound(event, "User not found");
  }

  const enhancedUser = await PlanUtil.enhanceUser(userEntity);
  const userPlan = enhancedUser.planInfo.plan;
  const permissions = getGenerationPermissions(userPlan);

  // Validate request
  const validationError = ValidationService.validateRequest(
    requestBody,
    permissions
  );
  if (validationError) {
    return ResponseUtil.badRequest(event, validationError.message);
  }

  const validatedPrompt = ValidationUtil.validateRequiredString(
    requestBody.prompt,
    "Prompt"
  );

  // Check limits
  const limitCheck = GenerationService.checkGenerationLimits(
    enhancedUser,
    requestBody.batchCount || 1
  );
  if (!limitCheck.allowed) {
    return ResponseUtil.forbidden(
      event,
      `Generation limit exceeded. Remaining: ${limitCheck.remaining}`
    );
  }

  // Check rate limits
  const rateLimitingService = getRateLimitingService();
  const rateLimitResult = await rateLimitingService.checkRateLimit(
    auth.userId,
    userPlan
  );
  if (!rateLimitResult.allowed) {
    return ResponseUtil.forbidden(
      event,
      rateLimitResult.reason || "Rate limit exceeded"
    );
  }

  // Get WebSocket connection
  const connectionId =
    requestBody.connectionId &&
    (await DynamoDBService.isValidUserConnectionId(
      auth.userId,
      requestBody.connectionId
    ))
      ? requestBody.connectionId
      : await DynamoDBService.getActiveConnectionIdForUser(auth.userId);

  if (!connectionId) {
    console.warn("No active WebSocket connection for user:", auth.userId);
  }

  // Initialize queue
  const priority = GenerationService.calculateUserPriority(userPlan);
  const initialWorkflowParams = GenerationService.createWorkflowParams(
    requestBody,
    validatedPrompt.trim()
  );

  const queueService = GenerationQueueService.getInstance();
  const queueEntry = await queueService.addToQueue(
    auth.userId,
    validatedPrompt.trim(),
    initialWorkflowParams,
    connectionId || undefined,
    priority
  );

  timer.checkpoint("Queue entry added");

  // Process prompt with unified workflow
  const processingResult = await PromptProcessor.processPrompt(
    validatedPrompt,
    requestBody,
    connectionId,
    queueEntry.queueId,
    queueEntry
  );

  timer.end();

  // Return result
  if (processingResult.success) {
    return ResponseUtil.success(event, processingResult.data);
  } else {
    return ResponseUtil.badRequest(event, processingResult.error!);
  }
};

// Export handler with authentication wrapper
export const handler = LambdaHandlerUtil.withAuth(handleGenerate, {
  requireBody: true,
});
