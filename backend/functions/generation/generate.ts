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
import { Media } from "@shared";
import { saveGeneratedMediaToDatabase, createGenerationId } from "./utils";

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
  images: Media[];
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

  const {
    prompt,
    negativePrompt = "",
    imageSize = "1024x1024",
    customWidth = 1024,
    customHeight = 1024,
    batchCount = 1,
    selectedLoras = [],
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
    return ResponseUtil.forbidden(event, "Negative prompts require a Pro plan");
  }

  // Validate custom image size
  if (imageSize === "custom" && !permissions.canUseCustomSize) {
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

  // Generate unique generation ID
  const generationId = createGenerationId();

  // For now, simulate image generation with placeholder images
  // TODO: Integrate with actual AI image generation service
  const mockUrls = Array(batchCount)
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

  // Save generated media to database
  const saveResult = await saveGeneratedMediaToDatabase({
    userId: auth.userId,
    generationId,
    batchCount,
    prompt: validatedPrompt.trim(),
    negativePrompt,
    imageSize: imageSize === "custom" ? `${customWidth}x${customHeight}` : imageSize,
    selectedLoras,
    mockUrls,
  });

  // Check if any saves failed
  if (saveResult.errors.length > 0) {
    console.warn(`⚠️ Some media failed to save:`, saveResult.errors);
  }

  const response: GenerationResponse = {
    images: saveResult.mediaEntities,
  };

  console.log(
    `✅ User ${auth.userId} generated and saved ${saveResult.savedCount}/${batchCount} image(s) to database, plan: ${userPlan}`
  );

  // Update user usage statistics (handled by the utility function for totalGeneratedMedias)
  try {
    await PlanUtil.updateUserUsageStats(auth.userId);
    console.log(`📊 Updated usage stats for user ${auth.userId}`);
  } catch (error) {
    console.error(
      `Failed to update usage stats for user ${auth.userId}:`,
      error
    );
    // Don't fail the generation if usage tracking fails
  }

  return ResponseUtil.success(event, response);
};

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

export const handler = LambdaHandlerUtil.withAuth(handleGenerate, {
  requireBody: true,
});
