/*
File objective: Generate AI images based on a prompt, enforcing plan-based limits and features.
Auth: Requires user session via LambdaHandlerUtil.withAuth.
Special notes:
- Validates prompt and optional parameters (negative prompt, size, batch, LoRAs)
- Enforces plan permissions (max batch, LoRA usage, negative prompts, custom sizes)
- Simulates generation with placeholder images (integration TODO); updates usage stats
- Returns metadata including generationId and estimatedTime
- Handles prompt optimization streaming via WebSocket when optimizePrompt is true
*/
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { PlanUtil } from "@shared/utils/plan";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";
import { getGenerationPermissions } from "@shared/utils/permissions";
import { getRateLimitingService } from "@shared/services/rate-limiting";
import { GenerationQueueService } from "@shared/services/generation-queue";
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

// Initialize API Gateway Management API client for direct connection messaging
const apiGatewayClient = new ApiGatewayManagementApiClient({
  endpoint: process.env["WEBSOCKET_API_ENDPOINT"],
});

// Helper interfaces
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

interface ValidationErrors {
  message: string;
  field?: string;
}

// Helper functions extracted from duplicated code

/**
 * Calculate image dimensions from size parameters
 */
function calculateImageDimensions(
  imageSize: string,
  customWidth: number,
  customHeight: number
): ImageDimensions {
  if (imageSize === "custom") {
    return { width: customWidth, height: customHeight };
  }

  const [widthStr, heightStr] = imageSize.split("x");
  return {
    width: parseInt(widthStr || "1024"),
    height: parseInt(heightStr || "1024"),
  };
}

/**
 * Calculate user priority based on plan
 */
function calculateUserPriority(userPlan: string): number {
  switch (userPlan) {
    case "unlimited":
      return 0; // Highest priority
    case "pro":
      return 100;
    case "starter":
      return 500;
    case "free":
    default:
      return 1000;
  }
}

/**
 * Validate LoRA-related parameters in a single place
 */
function validateLoRAUsage(
  selectedLoras: string[],
  loraSelectionMode: string,
  loraStrengths: Record<string, any>,
  permissions: any
): ValidationErrors | null {
  const hasLoraUsage =
    selectedLoras.length > 0 ||
    loraSelectionMode !== "auto" ||
    Object.keys(loraStrengths).length > 0;

  if (hasLoraUsage && !permissions.canUseLoRAModels) {
    return { message: "LoRA models require a Pro plan", field: "lora" };
  }

  return null;
}

/**
 * Validate request parameters
 */
function validateGenerationRequest(
  requestBody: GenerationRequest,
  permissions: any
): ValidationErrors | null {
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

  // Validate prompt
  const validatedPrompt = ValidationUtil.validateRequiredString(
    prompt,
    "Prompt"
  );
  if (validatedPrompt.length > 1000) {
    return {
      message: "Prompt is too long (max 1000 characters)",
      field: "prompt",
    };
  }

  // Validate negative prompt
  if (negativePrompt && negativePrompt.length > 500) {
    return {
      message: "Negative prompt is too long (max 500 characters)",
      field: "negativePrompt",
    };
  }

  // Validate batch count
  if (batchCount > 1 && !permissions.canUseBulkGeneration) {
    return {
      message: `Your plan allows maximum 1 image per batch`,
      field: "batchCount",
    };
  }

  // Validate LoRA usage (consolidated)
  const loraError = validateLoRAUsage(
    selectedLoras,
    loraSelectionMode,
    loraStrengths,
    permissions
  );
  if (loraError) return loraError;

  // Validate negative prompt usage
  if (
    negativePrompt &&
    negativePrompt.trim().length > 0 &&
    !permissions.canUseNegativePrompt
  ) {
    return {
      message: "Negative prompts require a Pro plan",
      field: "negativePrompt",
    };
  }

  // Validate custom image size
  if (imageSize === "custom" && !permissions.canSelectImageSizes) {
    return {
      message: "Custom image sizes require Pro plan",
      field: "imageSize",
    };
  }

  // Validate private content creation
  if (!isPublic && !permissions.canCreatePrivateContent) {
    return {
      message: "Private content creation requires a Pro plan",
      field: "isPublic",
    };
  }

  return null;
}

/**
 * Create WorkflowFinalParams from request (consolidated)
 */
function createWorkflowParams(
  requestBody: GenerationRequest,
  finalPrompt: string
): WorkflowFinalParams {
  const {
    negativePrompt = "",
    imageSize = "1024x1024",
    customWidth = 1024,
    customHeight = 1024,
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
    negativePrompt: negativePrompt.trim(),
  };
}

/**
 * Handle queue operations and response generation
 */
async function processGenerationQueue(
  queueService: any,
  auth: AuthResult,
  finalPrompt: string,
  workflowParams: WorkflowFinalParams,
  priority: number,
  optimizedPromptResult: string | null
): Promise<GenerationResponse> {
  // Add to queue with WebSocket connection ID if available
  const connectionId = await DynamoDBService.getActiveConnectionIdForUser(
    auth.userId
  );

  console.log("will add to queue");
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

  // Generate workflow data from request parameters
  const workflowData = generateWorkflowData(workflowParams);

  // Publish queue submission event to EventBridge for immediate processing
  try {
    await publishQueueSubmissionEvent(queueEntry.queueId, priority);
    console.log(
      `🚀 Published queue submission event for ${queueEntry.queueId}`
    );
  } catch (eventError) {
    console.error("Failed to publish queue submission event:", eventError);
    // Continue processing - the scheduled processor will pick it up as fallback
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
 * Handle prompt optimization with WebSocket streaming
 */
async function handlePromptOptimization(
  auth: AuthResult,
  validatedPrompt: string,
  requestBody: GenerationRequest,
  userPlan: string
): Promise<{
  finalPrompt: string;
  optimizedPromptResult: string | null;
  shouldReturn?: boolean;
  response?: GenerationResponse;
}> {
  try {
    console.log("🎨 Starting prompt optimization via WebSocket");

    // Add to queue first to get queueId for WebSocket streaming
    const queueService = GenerationQueueService.getInstance();

    // Get active WebSocket connection for the user
    const connectionId = await DynamoDBService.getActiveConnectionIdForUser(
      auth.userId
    );

    if (!connectionId) {
      console.log(
        "📭 No active WebSocket connection found for user, proceeding without optimization streaming"
      );
      return {
        finalPrompt: validatedPrompt.trim(),
        optimizedPromptResult: null,
      };
    }

    const priority = calculateUserPriority(userPlan);
    const tempWorkflowParams = createWorkflowParams(
      requestBody,
      validatedPrompt.trim()
    );

    // Add to queue to get queueId for WebSocket communication
    const queueEntry = await queueService.addToQueue(
      auth.userId,
      validatedPrompt.trim(),
      tempWorkflowParams,
      connectionId,
      priority
    );

    const queueId = queueEntry.queueId;

    // Stream optimization via WebSocket directly to connection
    const openRouterService = OpenRouterService.getInstance();
    let optimizedPrompt = "";

    // Send initial optimization event directly to connection
    if (connectionId) {
      await sendOptimizationMessageToConnection(connectionId, {
        type: "optimization_start",
        optimizationData: {
          originalPrompt: validatedPrompt.trim(),
          optimizedPrompt: "",
          completed: false,
        },
      });
    }

    // Start both moderation and optimization in parallel
    const moderationPromise = openRouterService.chatCompletion({
      instructionTemplate: "prompt-moderation",
      userMessage: validatedPrompt.trim(),
      model: "mistralai/mistral-medium-3.1",
      parameters: {
        temperature: 0.1,
        max_tokens: 256,
      },
    });

    const optimizationStreamPromise = openRouterService.chatCompletionStream({
      instructionTemplate: "prompt-optimization",
      userMessage: validatedPrompt.trim(),
      model: "mistralai/mistral-medium-3.1",
      parameters: {
        temperature: 0.7,
        max_tokens: 1024,
      },
    });

    // Get the stream and start streaming immediately
    const stream = await optimizationStreamPromise;

    let moderationPassed = false;
    let moderationChecked = false;
    let shouldStopStreaming = false;
    let moderationError: string | null = null;

    // Start streaming tokens while checking moderation concurrently
    const streamingPromise = (async () => {
      for await (const token of stream) {
        // Check if we should stop streaming due to moderation failure
        if (shouldStopStreaming) {
          console.log(
            "🛑 Stopping optimization streaming due to moderation failure"
          );
          break;
        }

        optimizedPrompt += token;
        if (connectionId) {
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
      }
      return optimizedPrompt.trim();
    })();

    // Check moderation result as soon as it's available
    moderationPromise
      .then((moderationResponse) => {
        const moderationContent = moderationResponse.content.trim();
        moderationChecked = true;

        if (moderationContent !== "OK") {
          console.log("❌ Prompt rejected by moderation:", moderationContent);

          // Extract reason from JSON response using regex
          let reason = "Content violates platform rules";
          const jsonMatch = moderationContent.match(
            /\{[^}]*"reason"\s*:\s*"([^"]+)"[^}]*\}/
          );
          if (jsonMatch && jsonMatch[1]) {
            reason = jsonMatch[1];
          }

          moderationError = reason;
          shouldStopStreaming = true;
          moderationPassed = false;
        } else {
          console.log("✅ Prompt passed moderation check");
          moderationPassed = true;
        }
      })
      .catch((error) => {
        console.error("❌ Moderation check failed:", error);
        moderationError = "Moderation check failed";
        shouldStopStreaming = true;
        moderationPassed = false;
        moderationChecked = true;
      });

    // Wait for streaming to complete
    await streamingPromise;

    // Wait for moderation to complete if it hasn't already
    if (!moderationChecked) {
      await moderationPromise;
    }

    // If moderation failed, send rejection message and throw error
    if (!moderationPassed) {
      if (connectionId) {
        await sendOptimizationMessageToConnection(connectionId, {
          type: "prompt-moderation",
          status: "refused",
          reason: moderationError || "Content violates platform rules",
        });
      }
      throw new Error(`Prompt moderation failed: ${moderationError}`);
    }

    const optimizedPromptResult = optimizedPrompt.trim();
    const finalPrompt = optimizedPromptResult;

    // Send completion event with final optimized prompt directly to connection
    // Only send this after both moderation and optimization are complete
    if (connectionId) {
      await sendOptimizationMessageToConnection(connectionId, {
        type: "optimization_complete",
        optimizationData: {
          originalPrompt: validatedPrompt.trim(),
          optimizedPrompt: optimizedPromptResult,
          completed: true,
        },
      });
    }

    console.log("✅ Prompt optimization completed via WebSocket");

    // Update the queue entry with the optimized prompt
    await queueService.updateQueueEntry(queueId, {
      prompt: finalPrompt,
      parameters: {
        ...tempWorkflowParams,
        prompt: finalPrompt,
      },
    });

    // Generate workflow data with optimized prompt
    const workflowData = generateWorkflowData({
      ...tempWorkflowParams,
      prompt: finalPrompt,
    });

    // Publish queue submission event for processing
    try {
      await publishQueueSubmissionEvent(queueId, priority);
      console.log(`🚀 Published queue submission event for ${queueId}`);
    } catch (eventError) {
      console.error("Failed to publish queue submission event:", eventError);
    }

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

    return { finalPrompt, optimizedPromptResult, shouldReturn: true, response };
  } catch (optimizationError) {
    console.error("❌ Prompt optimization failed:", optimizationError);
    // Continue with original prompt if optimization fails
    console.log("Continuing with original prompt due to optimization failure");
    return { finalPrompt: validatedPrompt.trim(), optimizedPromptResult: null };
  }
}

/**
 * Send optimization message directly to a WebSocket connection
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

    // If connection is gone, just log it (don't throw error to avoid disrupting generation)
    if (error.name === "GoneException") {
      console.log(
        `🧹 Connection ${connectionId} is gone, skipping optimization message`
      );
    }
  }
}

const handleGenerate = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  console.log("🎨 /generation/generate handler called");

  if (event.httpMethod !== "POST") {
    return ResponseUtil.badRequest(event, "Only POST method allowed");
  }

  console.log("✅ Authenticated user:", auth.userId);

  // Get user from database to check plan and usage
  const userEntity = await DynamoDBService.getUserById(auth.userId);
  if (!userEntity) {
    return ResponseUtil.notFound(event, "User not found");
  }

  // Enhance user with plan information
  const enhancedUser = await PlanUtil.enhanceUser(userEntity);

  const requestBody: GenerationRequest = LambdaHandlerUtil.parseJsonBody(event);

  // Check user permissions based on their plan
  const userPlan = enhancedUser.planInfo.plan;
  const permissions = getGenerationPermissions(userPlan);

  // Validate all request parameters in one place
  const validationError = validateGenerationRequest(requestBody, permissions);
  if (validationError) {
    return ResponseUtil.badRequest(event, validationError.message);
  }

  // Extract validated prompt for further processing
  const validatedPrompt = ValidationUtil.validateRequiredString(
    requestBody.prompt,
    "Prompt"
  );

  // Check generation limits
  const { allowed, remaining } = checkGenerationLimits(
    enhancedUser,
    requestBody.batchCount || 1
  );
  if (!allowed) {
    return ResponseUtil.forbidden(
      event,
      `Generation limit exceeded. Remaining: ${
        remaining === "unlimited" ? "unlimited" : remaining
      }`
    );
  }

  // Check rate limits with ComfyUI-specific rate limiting
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

  // Handle prompt optimization if requested
  let finalPrompt = validatedPrompt.trim();
  let optimizedPromptResult: string | null = null;

  if (requestBody.optimizePrompt) {
    const optimizationResult = await handlePromptOptimization(
      auth,
      validatedPrompt,
      requestBody,
      userPlan
    );

    finalPrompt = optimizationResult.finalPrompt;
    optimizedPromptResult = optimizationResult.optimizedPromptResult;

    // If optimization was completed with WebSocket, return early
    if (optimizationResult.shouldReturn && optimizationResult.response) {
      return ResponseUtil.success(event, optimizationResult.response);
    }
  }

  // Normal flow when optimization is not requested or failed
  const workflowParams = createWorkflowParams(requestBody, finalPrompt);
  const queueService = GenerationQueueService.getInstance();
  const priority = calculateUserPriority(userPlan);

  console.log("got queue service");

  try {
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

// Helper function to generate workflow data from parameters
function generateWorkflowData(params: WorkflowFinalParams): WorkflowData {
  try {
    // Convert WorkflowFinalParams to WorkflowParameters for createComfyUIWorkflow
    const workflowParams = {
      prompt: params.prompt,
      negativePrompt: params.negativePrompt,
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

    // Generate the ComfyUI workflow
    const workflow = createComfyUIWorkflow(workflowParams);

    // Create workflow data with sorted nodes
    const workflowData = createWorkflowData(workflow);

    return workflowData;
  } catch (error) {
    // Return minimal fallback workflow data
    return {
      nodes: [],
      totalNodes: 0,
      currentNodeIndex: 0,
      nodeOrder: [],
    };
  }
}

// Helper function to check generation limits
function checkGenerationLimits(
  user: UserWithPlanInfo,
  requestedCount: number
): { allowed: boolean; remaining: number | "unlimited" } {
  const plan: string = user.planInfo.plan;
  const usage = user.usageStats;

  // Define plan limits with better typing
  let monthlyLimit: number | "unlimited";
  let dailyLimit: number | "unlimited";

  switch (plan) {
    case "starter":
      monthlyLimit = 300;
      dailyLimit = 50;
      break;
    case "unlimited":
      monthlyLimit = "unlimited";
      dailyLimit = "unlimited";
      break;
    case "pro":
      monthlyLimit = "unlimited";
      dailyLimit = "unlimited";
      break;
    default: // free plan
      monthlyLimit = 30;
      dailyLimit = 1;
      break;
  }

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

async function publishQueueSubmissionEvent(
  queueId: string,
  priority: number
): Promise<void> {
  const eventBridge = new EventBridge();
  const EVENT_BUS_NAME =
    process.env["EVENTBRIDGE_BUS_NAME"] || "comfyui-events";

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

export const handler = LambdaHandlerUtil.withAuth(handleGenerate, {
  requireBody: true,
});
