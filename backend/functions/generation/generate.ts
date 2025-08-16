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
import { EventBridge } from "aws-sdk";
import {
  createComfyUIWorkflow,
  DEFAULT_WORKFLOW_PARAMS,
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
} from "@shared/shared-types";

// ====================================
// Constants and Configuration
// ====================================

const EVENT_BUS_NAME = process.env["EVENTBRIDGE_BUS_NAME"] || "comfyui-events";

// Plan limits configuration
const PLAN_LIMITS = {
  free: { monthly: 30, daily: 1, priority: 1000 },
  starter: { monthly: 300, daily: 50, priority: 500 },
  pro: { monthly: "unlimited", daily: "unlimited", priority: 100 },
  unlimited: { monthly: "unlimited", daily: "unlimited", priority: 0 },
} as const;

// Validation limits
const VALIDATION_LIMITS = {
  prompt: { maxLength: 1000 },
  negativePrompt: { maxLength: 500 },
} as const;

// Initialize AWS API Gateway client for WebSocket messaging
const apiGatewayClient = new ApiGatewayManagementApiClient({
  endpoint: process.env["WEBSOCKET_API_ENDPOINT"],
});

// ====================================
// Type Definitions
// ====================================

interface UserWithPlanInfo {
  planInfo: {
    plan: string;
  };
  usageStats: {
    imagesGeneratedThisMonth: number;
    imagesGeneratedToday: number;
  };
}

interface ImageDimensions {
  width: number;
  height: number;
}

interface ValidationError {
  message: string;
  field?: string;
}

interface ModerationResult {
  passed: boolean;
  reason?: string;
}

interface OptimizationResult {
  finalPrompt: string;
  optimizedPromptResult: string | null;
  selectedLoras?: string[];
  shouldReturn?: boolean;
  response?: GenerationResponse;
  moderationFailed?: boolean;
  moderationReason?: string;
}

interface GenerationLimitCheck {
  allowed: boolean;
  remaining: number | "unlimited";
}

// ====================================
// Validation Functions
// ====================================

/**
 * Validates the entire generation request against plan permissions and limits
 * @param requestBody - The generation request from the client
 * @param permissions - User's plan permissions
 * @returns ValidationError if validation fails, null otherwise
 */
function validateGenerationRequest(
  requestBody: GenerationRequest,
  permissions: any
): ValidationError | null {
  const {
    prompt,
    negativePrompt = "",
    imageSize = "1024x1024",
    batchCount = 1,
    selectedLoras = [],
    loraSelectionMode = "auto",
    loraStrengths = {},
    isPublic = true,
  } = requestBody;

  // Validate prompt presence and length
  try {
    const validatedPrompt = ValidationUtil.validateRequiredString(
      prompt,
      "Prompt"
    );
    if (validatedPrompt.length > VALIDATION_LIMITS.prompt.maxLength) {
      return {
        message: `Prompt is too long (max ${VALIDATION_LIMITS.prompt.maxLength} characters)`,
        field: "prompt",
      };
    }
  } catch (error) {
    return {
      message: "Prompt is required",
      field: "prompt",
    };
  }

  // Validate negative prompt length
  if (
    negativePrompt &&
    negativePrompt.length > VALIDATION_LIMITS.negativePrompt.maxLength
  ) {
    return {
      message: `Negative prompt is too long (max ${VALIDATION_LIMITS.negativePrompt.maxLength} characters)`,
      field: "negativePrompt",
    };
  }

  // Validate batch count against plan permissions
  if (batchCount > 1 && !permissions.canUseBulkGeneration) {
    return {
      message: "Your plan allows maximum 1 image per batch",
      field: "batchCount",
    };
  }

  // Validate LoRA usage
  const loraError = validateLoRAUsage(
    selectedLoras,
    loraSelectionMode,
    loraStrengths,
    permissions
  );
  if (loraError) return loraError;

  // Validate negative prompt usage permission
  if (negativePrompt?.trim() && !permissions.canUseNegativePrompt) {
    return {
      message: "Negative prompts require a Pro plan",
      field: "negativePrompt",
    };
  }

  // Validate custom image size permission
  if (imageSize === "custom" && !permissions.canSelectImageSizes) {
    return {
      message: "Custom image sizes require Pro plan",
      field: "imageSize",
    };
  }

  // Validate private content creation permission
  if (!isPublic && !permissions.canCreatePrivateContent) {
    return {
      message: "Private content creation requires a Pro plan",
      field: "isPublic",
    };
  }

  return null;
}

/**
 * Validates LoRA model usage against plan permissions
 * @param selectedLoras - Array of selected LoRA model names
 * @param loraSelectionMode - Mode for LoRA selection (auto/manual)
 * @param loraStrengths - Strength values for each LoRA
 * @param permissions - User's plan permissions
 * @returns ValidationError if LoRA usage is not allowed, null otherwise
 */
function validateLoRAUsage(
  selectedLoras: string[],
  loraSelectionMode: string,
  loraStrengths: Record<string, any>,
  permissions: any
): ValidationError | null {
  const hasLoraUsage =
    selectedLoras.length > 0 ||
    loraSelectionMode !== "auto" ||
    Object.keys(loraStrengths).length > 0;

  if (hasLoraUsage && !permissions.canUseLoRAModels) {
    return {
      message: "LoRA models require a Pro plan",
      field: "lora",
    };
  }

  return null;
}

// ====================================
// Utility Functions
// ====================================

/**
 * Calculates image dimensions from size string or custom values
 * @param imageSize - Size string (e.g., "1024x1024") or "custom"
 * @param customWidth - Custom width if imageSize is "custom"
 * @param customHeight - Custom height if imageSize is "custom"
 * @returns Object with width and height
 */
function calculateImageDimensions(
  imageSize: string,
  customWidth?: number,
  customHeight?: number
): ImageDimensions {
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

/**
 * Calculates queue priority based on user's plan
 * Lower numbers = higher priority
 * @param userPlan - User's subscription plan
 * @returns Priority value for queue ordering
 */
function calculateUserPriority(userPlan: string): number {
  const planKey = userPlan.toLowerCase() as keyof typeof PLAN_LIMITS;
  return PLAN_LIMITS[planKey]?.priority ?? PLAN_LIMITS.free.priority;
}

/**
 * Creates workflow parameters from the generation request
 * @param requestBody - The generation request
 * @param finalPrompt - The processed/optimized prompt
 * @param autoSelectedLoras - LoRAs selected automatically (if any)
 * @returns WorkflowFinalParams for ComfyUI workflow
 */
function createWorkflowParams(
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
    loraStrengths = {},
    loraSelectionMode = "auto",
    optimizePrompt = true,
  } = requestBody;

  const dimensions = calculateImageDimensions(
    imageSize,
    customWidth,
    customHeight
  );

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

/**
 * Checks if user has remaining generation quota
 * @param user - User with plan and usage information
 * @param requestedCount - Number of images requested
 * @returns Object indicating if generation is allowed and remaining quota
 */
function checkGenerationLimits(
  user: UserWithPlanInfo,
  requestedCount: number
): GenerationLimitCheck {
  const planKey = user.planInfo.plan.toLowerCase() as keyof typeof PLAN_LIMITS;
  const limits = PLAN_LIMITS[planKey] ?? PLAN_LIMITS.free;

  const { monthly: monthlyLimit, daily: dailyLimit } = limits;
  const usage = user.usageStats;

  // Check monthly limit
  if (monthlyLimit !== "unlimited") {
    const monthlyRemaining = monthlyLimit - usage.imagesGeneratedThisMonth;
    if (monthlyRemaining < requestedCount) {
      return { allowed: false, remaining: monthlyRemaining };
    }
  }

  // Check daily limit
  if (dailyLimit !== "unlimited") {
    const dailyRemaining = dailyLimit - usage.imagesGeneratedToday;
    if (dailyRemaining < requestedCount) {
      return { allowed: false, remaining: dailyRemaining };
    }
    return { allowed: true, remaining: dailyRemaining };
  }

  return { allowed: true, remaining: "unlimited" };
}

// ====================================
// WebSocket Communication
// ====================================

/**
 * Sends optimization-related messages to a WebSocket connection
 * @param connectionId - WebSocket connection ID
 * @param data - Message data to send
 */
async function sendOptimizationMessageToConnection(
  connectionId: string,
  data: any
): Promise<void> {
  try {
    const command = new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify({
        ...data,
        timestamp: new Date().toISOString(),
      }),
    });

    await apiGatewayClient.send(command);
    console.log(`📤 Sent optimization message to connection ${connectionId}`);
  } catch (error: any) {
    console.error(
      `❌ Failed to send optimization message to ${connectionId}:`,
      error
    );

    // Don't throw error for gone connections to avoid disrupting generation
    if (error.name === "GoneException") {
      console.log(
        `🧹 Connection ${connectionId} is gone, skipping optimization message`
      );
    }
  }
}

// ====================================
// Moderation, LoRA Selection and Optimization
// ====================================

/**
 * Performs automatic LoRA selection based on the user's prompt
 * @param validatedPrompt - The prompt to analyze for LoRA selection
 * @returns Array of selected LoRA names
 */
async function performAutoLoRASelection(
  validatedPrompt: string
): Promise<string[]> {
  try {
    console.log("🎯 Performing automatic LoRA selection");

    const openRouterService = OpenRouterService.getInstance();
    const loraSelectionResponse = await openRouterService.chatCompletion({
      instructionTemplate: "loras-selection",
      userMessage: validatedPrompt.trim(),
      model: "mistralai/mistral-medium-3.1",
      parameters: {
        temperature: 0.1,
        max_tokens: 512,
      },
    });

    const loraContent = loraSelectionResponse.content.trim();
    console.log("🎯 LoRA selection response:", loraContent);

    // Parse the response to extract LoRA names
    // Expected format could be JSON array or comma-separated list
    let selectedLoras: string[] = [];

    // First, try to find an array pattern using regex
    const arrayRegex = /\[\s*(?:"[^"]*"(?:\s*,\s*"[^"]*")*)\s*\]/;
    const arrayMatch = loraContent.match(arrayRegex);

    if (arrayMatch) {
      try {
        // Found an array pattern, try to parse it
        const arrayString = arrayMatch[0];
        const parsedArray = JSON.parse(arrayString);
        if (Array.isArray(parsedArray)) {
          selectedLoras = parsedArray.filter(
            (lora: any) => typeof lora === "string"
          );
          console.log("✅ Parsed LoRAs from array pattern:", selectedLoras);
          return selectedLoras;
        }
      } catch (regexParseError) {
        console.log("Failed to parse array pattern, trying other methods");
      }
    }

    try {
      // Try to parse as JSON first
      const parsedLoras = JSON.parse(loraContent);
      if (Array.isArray(parsedLoras)) {
        selectedLoras = parsedLoras.filter(
          (lora: any) => typeof lora === "string"
        );
      } else if (parsedLoras && Array.isArray(parsedLoras.loras)) {
        selectedLoras = parsedLoras.loras.filter(
          (lora: any) => typeof lora === "string"
        );
      }
    } catch (jsonError) {
      // If JSON parsing fails, try parsing as comma-separated list
      selectedLoras = loraContent
        .split(",")
        .map((lora) => lora.trim())
        .filter((lora) => lora.length > 0);
    }

    console.log("✅ Selected LoRAs:", selectedLoras);
    return selectedLoras;
  } catch (error) {
    console.error("❌ LoRA selection failed:", error);
    // Return empty array as fallback
    return [];
  }
}

/**
 * Performs content moderation on the user's prompt
 * @param validatedPrompt - The prompt to moderate
 * @param connectionId - WebSocket connection ID for updates
 * @param queueId - Queue entry ID to remove if moderation fails
 * @returns ModerationResult indicating if prompt passed moderation
 */
async function performPromptModeration(
  validatedPrompt: string,
  connectionId: string | null,
  queueId: string
): Promise<ModerationResult> {
  try {
    console.log("🛡️ Checking prompt moderation");

    const openRouterService = OpenRouterService.getInstance();
    const moderationResponse = await openRouterService.chatCompletion({
      instructionTemplate: "prompt-moderation",
      userMessage: validatedPrompt.trim(),
      model: "mistralai/mistral-medium-3.1",
      parameters: {
        temperature: 0.1,
        max_tokens: 256,
      },
    });

    const moderationContent = moderationResponse.content.trim();

    if (moderationContent !== "OK") {
      console.log("❌ Prompt rejected by moderation:", moderationContent);

      // Extract reason from JSON response
      let reason = "Content violates platform rules";
      const jsonMatch = moderationContent.match(
        /\{[^}]*"reason"\s*:\s*"([^"]+)"[^}]*\}/
      );
      if (jsonMatch?.[1]) {
        reason = jsonMatch[1];
      }

      // Notify user via WebSocket if connected
      if (connectionId) {
        await sendOptimizationMessageToConnection(connectionId, {
          type: "prompt-moderation",
          status: "refused",
          reason,
        });
      }

      // Clean up queue entry since generation won't proceed
      try {
        const queueService = GenerationQueueService.getInstance();
        await queueService.removeQueueEntry(queueId);
        console.log(
          `🗑️ Removed queue entry ${queueId} due to moderation failure`
        );
      } catch (removeError) {
        console.error("Failed to remove queue entry:", removeError);
      }

      return { passed: false, reason };
    }

    console.log("✅ Prompt passed moderation check");
    return { passed: true };
  } catch (error) {
    console.error("❌ Moderation check failed:", error);
    return {
      passed: false,
      reason: "Moderation check failed",
    };
  }
}

/**
 * Handles prompt optimization with streaming updates via WebSocket
 * @param validatedPrompt - The original prompt to optimize
 * @param requestBody - Full generation request
 * @param connectionId - WebSocket connection ID
 * @param queueId - Queue entry ID
 * @param queueEntry - Queue entry details
 * @param priority - User's queue priority
 * @returns OptimizationResult with final prompt, optimization details, and selected LoRAs
 */
async function handlePromptOptimization(
  validatedPrompt: string,
  requestBody: GenerationRequest,
  connectionId: string | null,
  queueId: string,
  queueEntry: QueueEntry,
  priority: number
): Promise<OptimizationResult> {
  try {
    console.log("🎨 Starting prompt optimization via WebSocket");

    // If no WebSocket connection, skip optimization streaming
    if (!connectionId) {
      console.log(
        "📭 No active WebSocket connection, proceeding without optimization streaming"
      );
      return {
        finalPrompt: validatedPrompt.trim(),
        optimizedPromptResult: null,
      };
    }

    const queueService = GenerationQueueService.getInstance();
    const openRouterService = OpenRouterService.getInstance();
    let optimizedPrompt = "";

    // Send initial optimization event
    await sendOptimizationMessageToConnection(connectionId, {
      type: "optimization_start",
      optimizationData: {
        originalPrompt: validatedPrompt.trim(),
        optimizedPrompt: "",
        completed: false,
      },
    });

    // Start moderation, optimization, and LoRA selection in parallel
    const moderationPromise = performPromptModeration(
      validatedPrompt,
      connectionId,
      queueId
    );

    // Only perform LoRA selection if mode is "auto"
    const loraSelectionPromise =
      requestBody.loraSelectionMode === "auto"
        ? performAutoLoRASelection(validatedPrompt)
        : Promise.resolve(requestBody.selectedLoras);

    const optimizationStreamPromise = openRouterService.chatCompletionStream({
      instructionTemplate: "prompt-optimization",
      userMessage: validatedPrompt.trim(),
      model: "mistralai/mistral-medium-3.1",
      parameters: {
        temperature: 0.7,
        max_tokens: 1024,
      },
    });

    // Handle streaming with moderation check
    const stream = await optimizationStreamPromise;
    let shouldStopStreaming = false;
    let moderationError: string | null = null;

    // Stream tokens while checking moderation concurrently
    const streamingPromise = (async () => {
      for await (const token of stream) {
        if (shouldStopStreaming) {
          console.log(
            "🛑 Stopping optimization streaming due to moderation failure"
          );
          break;
        }

        optimizedPrompt += token;
        await sendOptimizationMessageToConnection(connectionId, {
          type: "optimization_token",
          optimizationData: {
            originalPrompt: validatedPrompt.trim(),
            optimizedPrompt,
            token,
            completed: false,
          },
        });
      }
      return optimizedPrompt.trim();
    })();

    // Handle moderation result
    moderationPromise
      .then((moderationResult) => {
        if (!moderationResult.passed) {
          moderationError =
            moderationResult.reason || "Content violates platform rules";
          shouldStopStreaming = true;
        }
      })
      .catch((error) => {
        console.error("❌ Moderation check failed:", error);
        moderationError = "Moderation check failed";
        shouldStopStreaming = true;
      });

    // Wait for streaming to complete
    await streamingPromise;

    // Wait for moderation and LoRA selection to complete
    const [finalModerationResult, selectedLoras] = await Promise.all([
      moderationPromise,
      loraSelectionPromise,
    ]);

    requestBody.selectedLoras = selectedLoras;

    // If moderation failed, return early
    if (!finalModerationResult.passed) {
      return {
        finalPrompt: validatedPrompt.trim(),
        optimizedPromptResult: null,
        selectedLoras: [],
        moderationFailed: true,
        moderationReason: moderationError || "Content violates platform rules",
      };
    }

    const optimizedPromptResult = optimizedPrompt.trim();
    const finalPrompt = optimizedPromptResult || validatedPrompt.trim();

    console.log("✅ Selected LoRAs:", selectedLoras);

    // Send completion event
    await sendOptimizationMessageToConnection(connectionId, {
      type: "optimization_complete",
      optimizationData: {
        originalPrompt: validatedPrompt.trim(),
        optimizedPrompt: optimizedPromptResult,
        completed: true,
      },
    });

    console.log("✅ Prompt optimization completed via WebSocket");

    // Update queue entry with optimized prompt
    const workflowParams = createWorkflowParams(requestBody, finalPrompt);
    await queueService.updateQueueEntry(queueId, {
      prompt: finalPrompt,
      parameters: workflowParams,
    });

    // Generate workflow data
    const workflowData = generateWorkflowData(workflowParams);

    // Publish event for processing
    await publishQueueSubmissionEvent(queueId, priority);

    const response: GenerationResponse = {
      queueId,
      queuePosition: queueEntry.queuePosition || 1,
      estimatedWaitTime: queueEntry.estimatedWaitTime || 0,
      status: "pending",
      message: `Your request has been added to the queue with optimized prompt. Position: ${
        queueEntry.queuePosition || 1
      }`,
      workflowData,
      optimizedPrompt: optimizedPromptResult,
    };

    return {
      finalPrompt,
      optimizedPromptResult,
      selectedLoras,
      shouldReturn: true,
      response,
    };
  } catch (optimizationError: any) {
    console.error("❌ Prompt optimization failed:", optimizationError);

    // Check if this was a moderation failure
    if (optimizationError?.message?.includes("Prompt moderation failed")) {
      return {
        finalPrompt: validatedPrompt.trim(),
        optimizedPromptResult: null,
        selectedLoras: [],
        moderationFailed: true,
        moderationReason: optimizationError.message.replace(
          "Prompt moderation failed: ",
          ""
        ),
      };
    }

    // Continue with original prompt if optimization fails
    console.log("Continuing with original prompt due to optimization failure");
    return {
      finalPrompt: validatedPrompt.trim(),
      optimizedPromptResult: null,
      selectedLoras: [],
    };
  }
}

// ====================================
// Queue Management
// ====================================

/**
 * Processes generation request through the queue system
 * @param queueService - Queue service instance
 * @param auth - Authenticated user information
 * @param finalPrompt - The final prompt to use
 * @param workflowParams - Workflow parameters
 * @param priority - User's queue priority
 * @param optimizedPromptResult - Optimized prompt if available
 * @returns GenerationResponse with queue details
 */
async function processGenerationQueue(
  queueService: GenerationQueueService,
  auth: AuthResult,
  finalPrompt: string,
  workflowParams: WorkflowFinalParams,
  priority: number,
  optimizedPromptResult: string | null
): Promise<GenerationResponse> {
  // Get active WebSocket connection for real-time updates
  const connectionId = await DynamoDBService.getActiveConnectionIdForUser(
    auth.userId
  );

  console.log("Adding to queue");
  const queueEntry = await queueService.addToQueue(
    auth.userId,
    finalPrompt,
    workflowParams,
    connectionId || undefined,
    priority
  );

  console.log(
    `📋 Added generation request to queue: ${queueEntry.queueId} for user ${auth.userId}, position: ${queueEntry.queuePosition}`
  );

  // Generate workflow data from parameters
  const workflowData = generateWorkflowData(workflowParams);

  // Publish event for immediate processing
  try {
    await publishQueueSubmissionEvent(queueEntry.queueId, priority);
    console.log(
      `🚀 Published queue submission event for ${queueEntry.queueId}`
    );
  } catch (eventError) {
    console.error("Failed to publish queue submission event:", eventError);
    // Continue - scheduled processor will pick it up as fallback
  }

  return {
    queueId: queueEntry.queueId,
    queuePosition: queueEntry.queuePosition || 1,
    estimatedWaitTime: queueEntry.estimatedWaitTime || 0,
    status: "pending",
    message: `Your request has been added to the queue. Position: ${
      queueEntry.queuePosition || 1
    }`,
    workflowData,
    optimizedPrompt: optimizedPromptResult || undefined,
  };
}

/**
 * Publishes queue submission event to EventBridge for processing
 * @param queueId - Queue entry ID
 * @param priority - User's priority level
 */
async function publishQueueSubmissionEvent(
  queueId: string,
  priority: number
): Promise<void> {
  const eventBridge = new EventBridge();

  await eventBridge
    .putEvents({
      Entries: [
        {
          Source: "comfyui.queue",
          DetailType: "Queue Item Submission",
          Detail: JSON.stringify({
            queueId,
            priority,
            retryCount: 0,
          }),
          EventBusName: EVENT_BUS_NAME,
        },
      ],
    })
    .promise();
}

/**
 * Generates workflow data from workflow parameters
 * @param params - Workflow parameters
 * @returns WorkflowData structure for ComfyUI
 */
function generateWorkflowData(params: WorkflowFinalParams): WorkflowData {
  try {
    // Convert WorkflowFinalParams to WorkflowParameters
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

    // Generate ComfyUI workflow
    const workflow = createComfyUIWorkflow(workflowParams);

    // Create workflow data with sorted nodes
    return createWorkflowData(workflow);
  } catch (error) {
    console.error("Failed to generate workflow data:", error);
    // Return minimal fallback workflow data
    return {
      nodes: [],
      totalNodes: 0,
      currentNodeIndex: 0,
      nodeOrder: [],
    };
  }
}

// ====================================
// Main Handler
// ====================================

/**
 * Main handler for generation requests
 * @param event - API Gateway event
 * @param auth - Authenticated user information
 * @returns API Gateway response
 */
const handleGenerate = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  console.log("🎨 /generation/generate handler called");

  // Validate HTTP method
  if (event.httpMethod !== "POST") {
    return ResponseUtil.badRequest(event, "Only POST method allowed");
  }

  console.log("✅ Authenticated user:", auth.userId);

  // Fetch and validate user
  const userEntity = await DynamoDBService.getUserById(auth.userId);
  if (!userEntity) {
    return ResponseUtil.notFound(event, "User not found");
  }

  // Enhance user with plan information
  const enhancedUser = await PlanUtil.enhanceUser(userEntity);
  const userPlan = enhancedUser.planInfo.plan;

  // Parse request body
  const requestBody: GenerationRequest = LambdaHandlerUtil.parseJsonBody(event);

  // Get user permissions based on plan
  const permissions = getGenerationPermissions(userPlan);

  // Validate request against permissions
  const validationError = validateGenerationRequest(requestBody, permissions);
  if (validationError) {
    return ResponseUtil.badRequest(event, validationError.message);
  }

  // Extract and validate prompt
  const validatedPrompt = ValidationUtil.validateRequiredString(
    requestBody.prompt,
    "Prompt"
  );

  // Check generation limits
  const limitCheck = checkGenerationLimits(
    enhancedUser,
    requestBody.batchCount || 1
  );

  if (!limitCheck.allowed) {
    return ResponseUtil.forbidden(
      event,
      `Generation limit exceeded. Remaining: ${
        limitCheck.remaining === "unlimited"
          ? "unlimited"
          : limitCheck.remaining
      }`
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

  // Get WebSocket connection for real-time updates
  const connectionId = await DynamoDBService.getActiveConnectionIdForUser(
    auth.userId
  );

  if (!connectionId) {
    console.warn("No active WebSocket connection for user:", auth.userId);
  }

  // Calculate priority and create initial workflow params
  const priority = calculateUserPriority(userPlan);
  const initialWorkflowParams = createWorkflowParams(
    requestBody,
    validatedPrompt.trim()
  );

  // Initialize queue service and add entry
  const queueService = GenerationQueueService.getInstance();
  const queueEntry = await queueService.addToQueue(
    auth.userId,
    validatedPrompt.trim(),
    initialWorkflowParams,
    connectionId || undefined,
    priority
  );

  const queueId = queueEntry.queueId;

  // Handle prompt optimization if requested
  let finalPrompt = validatedPrompt.trim();
  let optimizedPromptResult: string | null = null;

  if (requestBody.optimizePrompt) {
    const optimizationResult = await handlePromptOptimization(
      validatedPrompt,
      requestBody,
      connectionId,
      queueId,
      queueEntry,
      priority
    );

    // Check for moderation failure
    if (optimizationResult.moderationFailed) {
      return ResponseUtil.badRequest(
        event,
        optimizationResult.moderationReason || "Content violates platform rules"
      );
    }

    finalPrompt = optimizationResult.finalPrompt;
    optimizedPromptResult = optimizationResult.optimizedPromptResult;

    // Return early if optimization completed with response
    if (optimizationResult.shouldReturn && optimizationResult.response) {
      return ResponseUtil.success(event, optimizationResult.response);
    }
  } else {
    // Perform moderation and LoRA selection in parallel if optimization is not requested
    const moderationPromise = performPromptModeration(
      validatedPrompt,
      connectionId,
      queueId
    );

    // Only perform LoRA selection if mode is "auto"
    const loraSelectionPromise =
      requestBody.loraSelectionMode === "auto"
        ? performAutoLoRASelection(validatedPrompt)
        : Promise.resolve(requestBody.selectedLoras);

    const [moderationResult, selectedLoras] = await Promise.all([
      moderationPromise,
      loraSelectionPromise,
    ]);

    requestBody.selectedLoras = selectedLoras;

    if (!moderationResult.passed) {
      return ResponseUtil.badRequest(
        event,
        moderationResult.reason || "Content violates platform rules"
      );
    }

    console.log("✅ Selected LoRAs (no optimization):", selectedLoras);
  }

  // Process generation through queue
  try {
    const workflowParams = createWorkflowParams(requestBody, finalPrompt);
    const response = await processGenerationQueue(
      queueService,
      auth,
      finalPrompt,
      workflowParams,
      priority,
      optimizedPromptResult
    );

    return ResponseUtil.success(event, response);
  } catch (queueError) {
    console.error("Failed to add request to queue:", queueError);
    return ResponseUtil.internalError(
      event,
      "Failed to process generation request"
    );
  }
};

// Export handler with authentication wrapper
export const handler = LambdaHandlerUtil.withAuth(handleGenerate, {
  requireBody: true,
});
