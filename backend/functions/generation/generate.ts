import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { PlanUtil } from "@shared/utils/plan";
import { UserAuthUtil } from "@shared/utils/user-auth";
import { getGenerationPermissions } from "@shared/utils/permissions";

interface GenerationRequest {
  prompt: string;
  negativePrompt?: string;
  imageSize?: string;
  customWidth?: number;
  customHeight?: number;
  batchCount?: number;
  selectedLoras?: string[];
}

interface GenerationResponse {
  success: boolean;
  data?: {
    images: string[];
    metadata: {
      prompt: string;
      imageSize: string;
      batchCount: number;
      generationId: string;
      estimatedTime: number;
    };
  };
  error?: string;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("🎨 /generation/generate handler called");

  if (event.httpMethod === "OPTIONS") {
    console.log("⚡ Handling OPTIONS request");
    return ResponseUtil.noContent(event);
  }

  if (event.httpMethod !== "POST") {
    return ResponseUtil.badRequest(event, "Only POST method allowed");
  }

  try {
    // Extract user authentication using centralized utility
    const authResult = await UserAuthUtil.requireAuth(event);

    // Handle error response from authentication
    if (UserAuthUtil.isErrorResponse(authResult)) {
      return authResult;
    }

    const userId = authResult.userId!;
    console.log("✅ Authenticated user:", userId);

    // Get user from database to check plan and usage
    const userEntity = await DynamoDBService.getUserById(userId);
    if (!userEntity) {
      return ResponseUtil.notFound(event, "User not found");
    }

    // Enhance user with plan information
    const enhancedUser = await PlanUtil.enhanceUser(userEntity);

    // Parse request body
    let requestBody: GenerationRequest;
    try {
      requestBody = JSON.parse(event.body || "{}");
    } catch (error) {
      return ResponseUtil.badRequest(event, "Invalid JSON in request body");
    }

    const {
      prompt,
      negativePrompt = "",
      imageSize = "1024x1024",
      customWidth = 1024,
      customHeight = 1024,
      batchCount = 1,
      selectedLoras = [],
    } = requestBody;

    // Validate required fields
    if (!prompt || prompt.trim().length === 0) {
      return ResponseUtil.badRequest(event, "Prompt is required");
    }

    if (prompt.length > 1000) {
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
    if (batchCount > permissions.maxBatch) {
      return ResponseUtil.forbidden(
        event,
        `Your plan allows maximum ${permissions.maxBatch} image${
          permissions.maxBatch === 1 ? "" : "s"
        } per batch`
      );
    }

    // Validate LoRA usage
    if (selectedLoras.length > 0 && !permissions.canUseLoRA) {
      return ResponseUtil.forbidden(event, "LoRA models require a Pro plan");
    }

    // Validate negative prompt usage
    if (
      negativePrompt &&
      negativePrompt.trim().length > 0 &&
      !permissions.canUseNegativePrompt
    ) {
      return ResponseUtil.forbidden(
        event,
        "Negative prompts require a Pro plan"
      );
    }

    // Validate custom image size
    if (imageSize === "custom" && !permissions.canUseCustomSize) {
      return ResponseUtil.forbidden(
        event,
        "Custom image sizes require Pro plan"
      );
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

    // Generate unique generation ID
    const generationId = `gen_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // For now, simulate image generation with placeholder images
    // TODO: Integrate with actual AI image generation service
    const mockImages = Array(batchCount)
      .fill(null)
      .map((_, index) => {
        const width =
          imageSize === "custom"
            ? customWidth
            : parseInt(imageSize?.split("x")[0] || "1024");
        const height =
          imageSize === "custom"
            ? customHeight
            : parseInt(imageSize?.split("x")[1] || "1024");
        return `https://picsum.photos/${width}/${height}?random=${generationId}_${index}`;
      });

    // Simulate processing time
    const estimatedTime = batchCount * 2000 + Math.random() * 1000; // 2-3 seconds per image

    const response: GenerationResponse = {
      success: true,
      data: {
        images: mockImages,
        metadata: {
          prompt: prompt.trim(),
          imageSize:
            imageSize === "custom"
              ? `${customWidth}x${customHeight}`
              : imageSize,
          batchCount,
          generationId,
          estimatedTime: Math.round(estimatedTime),
        },
      },
    };

    console.log(
      `✅ Generated ${batchCount} image(s) for user ${userId}, plan: ${userPlan}`
    );

    // Update user usage statistics
    try {
      await PlanUtil.updateUserUsageStats(userId);
      console.log(`📊 Updated usage stats for user ${userId}`);
    } catch (error) {
      console.error(`Failed to update usage stats for user ${userId}:`, error);
      // Don't fail the generation if usage tracking fails
    }

    return ResponseUtil.success(event, response.data);
  } catch (error) {
    console.error("💥 Generation error:", error);
    return ResponseUtil.internalError(event, "Failed to generate images");
  }
};

// Helper function to check generation limits
function checkGenerationLimits(
  user: any,
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
