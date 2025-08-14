/*
File objective: Generate AI images based on a prompt, enforcing plan-based limits and features.
Auth: Requires user session via LambdaHandlerUtil.withAuth.
Special notes:
- Validates prompt and optional parameters (negative prompt, size, batch, LoRAs)
- Enforces plan permissions (max batch, LoRA usage, negative prompts, custom sizes)
- Simulates generation with placeholder images (integration TODO); updates usage stats
- Returns metadata including generationId and estimatedTime
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
import type {
  GenerationResponse,
  GenerationRequest,
  WorkflowFinalParams,
  WorkflowData,
} from "@shared/shared-types";

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

  const {
    prompt,
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

  // Validate required fields using shared validation
  const validatedPrompt = ValidationUtil.validateRequiredString(
    prompt,
    "Prompt"
  );

  if (validatedPrompt.length > 1000) {
    return ResponseUtil.badRequest(
      event,
      "Prompt is too long (max 1000 characters)"
    );
  }

  // Validate negative prompt if provided
  if (negativePrompt && negativePrompt.length > 500) {
    return ResponseUtil.badRequest(
      event,
      "Negative prompt is too long (max 500 characters)"
    );
  }

  // Check user permissions based on their plan
  const userPlan = enhancedUser.planInfo.plan;
  const permissions = getGenerationPermissions(userPlan);

  // Validate batch count
  if (batchCount > 1 && !permissions.canUseBulkGeneration) {
    return ResponseUtil.forbidden(
      event,
      `Your plan allows maximum 1 image per batch`
    );
  }

  // Validate LoRA usage
  if (selectedLoras.length > 0 && !permissions.canUseLoRAModels) {
    return ResponseUtil.forbidden(event, "LoRA models require a Pro plan");
  }

  // Validate LoRA usage
  if (loraSelectionMode !== "auto" && !permissions.canUseLoRAModels) {
    return ResponseUtil.forbidden(event, "LoRA models require a Pro plan");
  }

  // Validate LoRA usage
  if (Object.keys(loraStrengths).length > 0 && !permissions.canUseLoRAModels) {
    return ResponseUtil.forbidden(event, "LoRA models require a Pro plan");
  }

  // Validate negative prompt usage
  if (
    negativePrompt &&
    negativePrompt.trim().length > 0 &&
    !permissions.canUseNegativePrompt
  ) {
    return ResponseUtil.forbidden(event, "Negative prompts require a Pro plan");
  }

  // Validate custom image size
  if (imageSize === "custom" && !permissions.canSelectImageSizes) {
    return ResponseUtil.forbidden(event, "Custom image sizes require Pro plan");
  }

  // Check generation limits
  const { allowed, remaining } = checkGenerationLimits(
    enhancedUser,
    batchCount
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

  // Optimize prompt if requested and user has permission
  let finalPrompt = validatedPrompt.trim();
  let optimizedPrompt: string | undefined;

  console.log(
    "🔍 Optimizing prompt using OpenRouter service: ",
    optimizePrompt
  );

  if (optimizePrompt) {
    try {
      console.log("🔍 Optimizing prompt using OpenRouter service");
      const openRouterService = OpenRouterService.getInstance();

      const response = await openRouterService.chatCompletion({
        instructionTemplate: "prompt-optimization",
        userMessage: validatedPrompt.trim(),
        model: "mistralai/mistral-medium-3.1",
        parameters: {
          temperature: 0.7,
          max_tokens: 1024,
        },
      });

      optimizedPrompt = response.content.trim();
      finalPrompt = optimizedPrompt;

      console.log(
        `✅ Prompt optimized: "${validatedPrompt}" → "${optimizedPrompt}"`
      );
    } catch (optimizationError) {
      console.warn(
        "⚠️ Prompt optimization failed, using original prompt:",
        optimizationError
      );
      // Continue with original prompt if optimization fails
    }
  }

  // Create workflow parameters for queue entry
  const workflowParams: WorkflowFinalParams = {
    width:
      imageSize === "custom"
        ? customWidth
        : parseInt(imageSize?.split("x")[0] || "1024"),
    height:
      imageSize === "custom"
        ? customHeight
        : parseInt(imageSize?.split("x")[1] || "1024"),
    steps: 20, // Default steps
    cfg_scale: 7.0, // Default CFG scale
    batch_size: batchCount,
    loraSelectionMode,
    loraStrengths,
    selectedLoras,
    optimizePrompt,
    prompt: finalPrompt,
    negativePrompt: negativePrompt.trim(),
  };

  // Get queue service and add request to queue
  const queueService = GenerationQueueService.getInstance();

  // Determine priority based on user plan
  let priority = 1000; // Default priority
  switch (userPlan) {
    case "unlimited":
      priority = 0; // Highest priority
      break;
    case "pro":
      priority = 100;
      break;
    case "starter":
      priority = 500;
      break;
    case "free":
      priority = 1000;
      break;
  }

  // Add to queue with WebSocket connection ID if available
  const connectionId = event.requestContext?.connectionId;

  try {
    const queueEntry = await queueService.addToQueue(
      auth.userId,
      validatedPrompt.trim(),
      workflowParams,
      connectionId,
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

    const response: GenerationResponse = {
      queueId: queueEntry.queueId,
      queuePosition: queueEntry.queuePosition || 1,
      estimatedWaitTime: queueEntry.estimatedWaitTime || 0,
      status: "pending",
      message: `Your request has been added to the queue. Position: ${
        queueEntry.queuePosition || 1
      }`,
      workflowData,
      optimizedPrompt,
    };

    // Note: WebSocket communication will be handled by EventBridge when
    // the queue processing begins and events are published

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
interface UserWithPlanInfo {
  planInfo: {
    plan: string;
  };
  usageStats: {
    imagesGeneratedThisMonth: number;
    imagesGeneratedToday: number;
  };
}

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
