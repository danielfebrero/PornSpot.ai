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
import {
  LambdaHandlerUtil,
  OptionalAuthResult,
} from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";
import { getGenerationPermissions } from "@shared/utils/permissions";
import { SimplifiedRateLimitingService } from "@shared/services/simple-rate-limiting";
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
import { PromptProcessingService } from "@shared/services/prompt-processing";
import {
  formatSettingsForPrompt,
  generatePromptSettings,
} from "@shared/utils/prompt-settings-generator";

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
    prompt: { maxLength: 2000 },
    negativePrompt: {
      maxLength: 500,
      defaultValue:
        "ugly, distorted bad teeth, bad hands, distorted face, missing fingers, multiple limbs, distorted arms, distorted legs, low quality, distorted fingers, weird legs, distorted eyes, pixelated, extra fingers, watermark",
    },
    cfgScale: { min: 1, max: 10, default: 4.5 },
    steps: { min: 5, max: 60, default: 30 },
    seed: { min: 0, max: 2147483647, default: 0 }, // Max 32-bit signed integer
  },
  MODELS: {
    moderation: "mistralai/mistral-medium-3.1",
    optimization: "mistralai/mistral-medium-3.1",
    loraSelection: "mistralai/mistral-medium-3.1",
    randomPrompt: "mistralai/mistral-medium-3.1",
  },
  AI_PARAMS: {
    temperature: {
      moderation: 0.1,
      optimization: 0.7,
      loraSelection: 0.1,
      titleGeneration: 0.7,
      randomPrompt: 1.1,
    },
    maxTokens: {
      moderation: 256,
      optimization: 1024,
      loraSelection: 512,
      titleGeneration: 128,
      randomPrompt: 512,
    },
  },
  LORAS: {
    defaultStrength: 1,
    customStrength: {
      DynaPoseV1: 0.2,
      bread: 1,
      Sextoy_Dildo_Pussy_v2_XL: 1,
      RealDownblouseXLv3: 1,
      Harness_Straps_sdxl: 1,
      bdsm_SDXL_1_: 1,
      "Body Tattoo_alpha1.0_rank4_noxattn_last": 1,
      "Doggystyle anal XL": 1,
      "add-detail-xl": 1,
      "Pierced_Nipples_XL_Barbell_Edition-000013": 0.5,
      leaked_nudes_style_v1_fixed: 1,
      nudify_xl_lite: 0.5,
    } as Record<string, number>,
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
  shouldStop?: boolean;
}

// Shared control object for parallel operations
interface ProcessingController {
  shouldStop: boolean;
  stop(): void;
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

  static async generateRandomPrompt(): Promise<string> {
    const timer = new PerformanceTimer("Random Prompt Generation");

    try {
      // Generate weighted random settings
      const settings = generatePromptSettings();
      const settingsMessage = formatSettingsForPrompt(settings);

      console.log("🎲 Generated random settings:", settingsMessage);

      const content = await this.chatCompletion(
        "generate-random-image-prompt",
        settingsMessage,
        CONFIG.AI_PARAMS.temperature.randomPrompt,
        CONFIG.AI_PARAMS.maxTokens.randomPrompt
      );

      return content.trim();
    } catch (error) {
      console.error("❌ Random prompt generation failed:", error);
      throw new Error("Failed to generate random prompt");
    } finally {
      timer.end();
    }
  }

  static async performModeration(
    prompt: string,
    controller?: ProcessingController
  ): Promise<ProcessingResult<void>> {
    const timer = new PerformanceTimer("Moderation");

    try {
      const moderationResult = await PromptProcessingService.moderatePrompt(
        prompt
      );

      if (!moderationResult.success) {
        if (controller) {
          controller.stop();
        }

        return {
          success: false,
          error: moderationResult.reason,
          shouldStop: true,
        };
      }

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
      this.validateCfgScale,
      this.validateSteps,
      // this.validateSeed,
    ];

    console.log("Request body for validation:", requestBody);

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

    if (prompt === undefined || prompt === null) {
      return null;
    }

    if (typeof prompt !== "string") {
      return { message: "Prompt must be a string", field: "prompt" };
    }

    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt.length === 0) {
      return null;
    }

    if (trimmedPrompt.length > CONFIG.VALIDATION_LIMITS.prompt.maxLength) {
      return {
        message: `Prompt is too long (max ${CONFIG.VALIDATION_LIMITS.prompt.maxLength} characters)`,
        field: "prompt",
      };
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

    if (
      negativePrompt?.trim() &&
      !permissions.canUseNegativePrompt &&
      negativePrompt?.trim() !==
        CONFIG.VALIDATION_LIMITS.negativePrompt.defaultValue
    ) {
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

  private static validateCfgScale(
    requestBody: GenerationRequest,
    permissions: any
  ): ValidationError | null {
    const { cfgScale } = requestBody;

    // If cfgScale is not provided, use default value
    if (
      cfgScale === undefined ||
      cfgScale === null ||
      cfgScale === DEFAULT_WORKFLOW_PARAMS.cfgScale
    ) {
      return null;
    }

    // Check permission for using CFG Scale
    if (!permissions.canUseCfgScale) {
      return {
        message: "CFG Scale control requires a Pro plan",
        field: "cfgScale",
      };
    }

    // Validate range
    const { min, max } = CONFIG.VALIDATION_LIMITS.cfgScale;
    if (cfgScale < min || cfgScale > max) {
      return {
        message: `CFG Scale must be between ${min} and ${max}`,
        field: "cfgScale",
      };
    }

    return null;
  }

  private static validateSteps(
    requestBody: GenerationRequest,
    permissions: any
  ): ValidationError | null {
    const { steps } = requestBody;

    // If steps is not provided, use default value
    if (
      steps === undefined ||
      steps === null ||
      steps === DEFAULT_WORKFLOW_PARAMS.steps
    ) {
      return null;
    }

    // Check permission for using Steps
    if (!permissions.canUseSteps) {
      return {
        message: "Steps control requires a Pro plan",
        field: "steps",
      };
    }

    // Validate range and ensure it's an integer
    const { min, max } = CONFIG.VALIDATION_LIMITS.steps;
    if (!Number.isInteger(steps) || steps < min || steps > max) {
      return {
        message: `Steps must be an integer between ${min} and ${max}`,
        field: "steps",
      };
    }

    return null;
  }

  //   private static validateSeed(
  //     requestBody: GenerationRequest,
  //     permissions: any
  //   ): ValidationError | null {
  //     const { seed } = requestBody;

  //     // If seed is not provided, use default value
  //     if (
  //       seed === undefined ||
  //       seed === null ||
  //       seed === DEFAULT_WORKFLOW_PARAMS.seed
  //     ) {
  //       return null;
  //     }

  //     // Check permission for using Seed
  //     if (!permissions.canUseSeed) {
  //       return {
  //         message: "Seed control requires a Pro plan",
  //         field: "seed",
  //       };
  //     }

  //     // Validate range and ensure it's an integer
  //     const { min, max } = CONFIG.VALIDATION_LIMITS.seed;
  //     if (!Number.isInteger(seed) || seed < min || seed > max) {
  //       return {
  //         message: `Seed must be an integer between ${min} and ${max} (use -1 for random)`,
  //         field: "seed",
  //       };
  //     }

  //     return null;
  //   }
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
        width: Math.max(Math.min(customWidth || 1024, 2048), 64),
        height: Math.max(Math.min(customHeight || 1024, 2048), 64),
      };
    }

    const [widthStr, heightStr] = imageSize.split("x");
    return {
      width: Math.max(Math.min(parseInt(widthStr || "1024", 10), 2048), 64),
      height: Math.max(Math.min(parseInt(heightStr || "1024", 10), 2048), 64),
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
      cfgScale = CONFIG.VALIDATION_LIMITS.cfgScale.default,
      steps = CONFIG.VALIDATION_LIMITS.steps.default,
      seed = CONFIG.VALIDATION_LIMITS.seed.default,
      isPublic = true,
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
        acc[lora] = {
          mode: "auto",
          value:
            CONFIG.LORAS.customStrength[lora] || CONFIG.LORAS.defaultStrength,
        }; // here we set lora strength
        return acc;
      }, {} as Record<string, { mode: "auto"; value: number }>);
    }

    return {
      width: dimensions.width,
      height: dimensions.height,
      steps: steps,
      cfg_scale: cfgScale,
      batch_size: batchCount,
      loraSelectionMode,
      loraStrengths,
      selectedLoras,
      optimizePrompt,
      prompt: finalPrompt,
      negativePrompt: negativePrompt?.trim(),
      seed: seed,
      isPublic,
    };
  }

  static generateWorkflowData(params: WorkflowFinalParams): WorkflowData {
    try {
      const workflowParams = {
        prompt: params.prompt,
        negativePrompt:
          params.negativePrompt || DEFAULT_WORKFLOW_PARAMS.negativePrompt!,
        width: params.width || DEFAULT_WORKFLOW_PARAMS.width!,
        height: params.height || DEFAULT_WORKFLOW_PARAMS.height!,
        batchSize: params.batch_size || DEFAULT_WORKFLOW_PARAMS.batchSize!,
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
      const strength =
        loraConfig?.mode === "auto"
          ? CONFIG.LORAS.customStrength[loraName] ||
            CONFIG.LORAS.defaultStrength
          : loraConfig?.value ||
            CONFIG.LORAS.customStrength[loraName] ||
            CONFIG.LORAS.defaultStrength;

      return {
        id: `lora_${index}`,
        name: loraName,
        strength,
      };
    }
  );
}

class PromptProcessor {
  static async processPrompt(
    validatedPrompt: string,
    requestBody: GenerationRequest,
    connectionId: string | null,
    queueId: string,
    queueEntry: QueueEntry,
    options: { skipModeration?: boolean; skipOptimization?: boolean } = {}
  ): Promise<ProcessingResult<GenerationResponse>> {
    const timer = new PerformanceTimer("Unified Prompt Processing");
    const queueService = GenerationQueueService.getInstance();
    const skipModeration = options.skipModeration ?? false;
    const skipOptimization = options.skipOptimization ?? false;

    try {
      // Initialize optimization state
      if (!skipOptimization && requestBody.optimizePrompt && connectionId) {
        await WebSocketService.sendOptimizationMessage(connectionId, {
          type: "optimization_start",
          optimizationData: {
            originalPrompt: validatedPrompt.trim(),
            optimizedPrompt: "",
            completed: false,
          },
        });
      }

      // Create a shared controller for parallel operations
      const controller: ProcessingController = {
        shouldStop: false,
        stop() {
          this.shouldStop = true;
        },
      };

      // Perform all operations in parallel
      const [moderationResult, selectedLoras, optimizedPrompt] =
        await Promise.all([
          // Conditionally perform moderation
          skipModeration
            ? Promise.resolve<ProcessingResult<void>>({ success: true })
            : AIService.performModeration(validatedPrompt, controller),

          // Conditionally perform LoRA selection
          requestBody.loraSelectionMode === "auto"
            ? AIService.selectLoras(
                requestBody.originalPrompt || validatedPrompt
              )
            : Promise.resolve(requestBody.selectedLoras || []),

          // Conditionally perform optimization
          !skipOptimization && requestBody.optimizePrompt && connectionId
            ? this.streamOptimization(validatedPrompt, connectionId, controller)
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
    connectionId: string,
    controller?: ProcessingController
  ): Promise<string> {
    // Check if we should return prematurely before starting
    if (controller?.shouldStop) {
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
      if (controller?.shouldStop) {
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
  auth: OptionalAuthResult
): Promise<APIGatewayProxyResult> => {
  const timer = new PerformanceTimer("Generation Handler");

  // Validate HTTP method
  if (event.httpMethod !== "POST") {
    return ResponseUtil.badRequest(event, "Only POST method allowed");
  }

  // Parse request and fetch user
  const requestBody: GenerationRequest = LambdaHandlerUtil.parseJsonBody(event);

  const promptProvided =
    typeof requestBody.prompt === "string" &&
    requestBody.prompt.trim().length > 0;
  let usedGeneratedPrompt = false;

  if (!promptProvided) {
    try {
      const generatedPrompt = await AIService.generateRandomPrompt();
      requestBody.prompt = generatedPrompt;
      requestBody.originalPrompt = generatedPrompt;
      usedGeneratedPrompt = true;
    } catch (error) {
      console.error("❌ Failed to generate random prompt:", error);
      return ResponseUtil.internalError(
        event,
        "Failed to generate random prompt"
      );
    }
  }

  // Replace seed of 0 with a random number
  if (requestBody.seed === 0) {
    requestBody.seed = Math.floor(Math.random() * 2147483647);
  }

  let enhancedUser: User | null = null;
  if (auth.userId) {
    const userEntity = await DynamoDBService.getUserById(auth.userId);
    enhancedUser = await PlanUtil.enhanceUser(userEntity!);
  }

  const userPlan = enhancedUser?.planInfo.plan || "anonymous";
  const permissions = await getGenerationPermissions(userPlan);

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

  // Check simplified rate limits (single image at a time + usage stats + IP limit for anonymous)
  const simplifiedRateLimitingService =
    SimplifiedRateLimitingService.getInstance();
  if (!usedGeneratedPrompt) {
    const rateLimitResult = await simplifiedRateLimitingService.checkRateLimit(
      event,
      enhancedUser ?? undefined
    );
    if (!rateLimitResult.allowed) {
      return ResponseUtil.forbidden(
        event,
        rateLimitResult.reason || "Rate limit exceeded"
      );
    }
  }

  // Anonymous users can only generate 1 image at a time (already enforced by rate limiting)
  if (!enhancedUser) {
    const batchCount = requestBody.batchCount || 1;
    if (batchCount > 1) {
      return ResponseUtil.forbidden(
        event,
        "Anonymous users can only generate 1 image at a time"
      );
    }
  }

  // Save generation settings for authenticated users
  if (auth.userId && promptProvided) {
    try {
      await DynamoDBService.createGenerationSettingsFromRequest(
        auth.userId,
        requestBody
      );
      console.log(`✅ Saved generation settings for user: ${auth.userId}`);
    } catch (error) {
      console.error(
        `❌ Failed to save generation settings for user ${auth.userId}:`,
        error
      );
      // Don't fail the generation if settings save fails
    }
  } else if (auth.userId) {
    console.log(
      `ℹ️ Skipped saving generation settings for user ${auth.userId}: prompt not provided`
    );
  }

  // Get WebSocket connection (only for authenticated users)
  let connectionId: string | null = null;
  if (auth.userId) {
    connectionId =
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
  } else {
    console.log("Anonymous user - no WebSocket connection available");
    connectionId = requestBody.connectionId || null;
  }

  // Initialize queue
  const priority = GenerationService.calculateUserPriority(userPlan);
  const initialWorkflowParams = GenerationService.createWorkflowParams(
    requestBody,
    validatedPrompt.trim()
  );

  const queueService = GenerationQueueService.getInstance();
  const queueEntry = await queueService.addToQueue(
    auth.userId || null, // Allow null for anonymous users
    validatedPrompt.trim(),
    initialWorkflowParams,
    connectionId || undefined,
    priority
  );

  timer.checkpoint("Queue entry added");

  // Update user usage statistics for authenticated users
  if (auth.userId) {
    try {
      await PlanUtil.updateUserUsageStats(auth.userId, requestBody.batchCount);
      console.log(`✅ Updated usage stats for user: ${auth.userId}`);
    } catch (error) {
      console.error(
        `❌ Failed to update usage stats for user ${auth.userId}:`,
        error
      );
      // Don't fail the generation if stats update fails
    }
  }

  // Record IP generation for both authenticated and anonymous users
  try {
    if (!usedGeneratedPrompt) {
      await simplifiedRateLimitingService.recordGeneration(
        event,
        enhancedUser
          ? {
              userId: enhancedUser.userId,
              plan: enhancedUser.planInfo.plan,
              bonusGenerationCredits:
                enhancedUser.usageStats.bonusGenerationCredits,
            }
          : undefined,
        requestBody.batchCount ?? 1
      );
      console.log(
        `✅ Recorded IP generation for ${
          enhancedUser ? "authenticated" : "anonymous"
        } user`
      );
    } else {
      console.log("ℹ️ Skipped rate limiting record for auto-generated prompt");
    }
  } catch (error) {
    console.error("❌ Failed to record IP generation:", error);
    // Don't fail the generation if IP recording fails
  }

  // Process prompt with unified workflow
  const processingResult = await PromptProcessor.processPrompt(
    validatedPrompt,
    requestBody,
    connectionId,
    queueEntry.queueId,
    queueEntry,
    {
      skipModeration: usedGeneratedPrompt,
      skipOptimization: usedGeneratedPrompt,
    }
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
export const handler = LambdaHandlerUtil.withOptionalAuth(handleGenerate, {
  requireBody: true,
});
