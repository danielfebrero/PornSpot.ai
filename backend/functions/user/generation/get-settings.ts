/*
File objective: Get user generation settings.
Auth: Requires user session via LambdaHandlerUtil.withAuth.
Special notes:
- Returns user's saved generation settings
- Returns null if no settings are found (user can use defaults)
- Settings include: image size, custom dimensions, batch count, isPublic, cfg scale, steps, negative prompt
*/
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";

const handleGetSettings = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  const { userId } = auth;

  console.log("🎨 Get generation settings function called");

  // Route based on HTTP method
  switch (event.httpMethod) {
    case "GET":
      return await getSettings(event, userId);
    default:
      return ResponseUtil.error(event, "Method not allowed", 405);
  }
};

async function getSettings(
  event: APIGatewayProxyEvent,
  userId: string
): Promise<APIGatewayProxyResult> {
  try {
    console.log(`📋 Getting generation settings for user ${userId}`);

    // Get generation settings from DynamoDB
    const settings = await DynamoDBService.getGenerationSettings(userId);

    if (settings) {
      console.log(`✅ Retrieved generation settings for user: ${userId}`);

      // Convert the entity to a more frontend-friendly format
      const settingsResponse = {
        imageSize: settings.imageSize,
        customWidth: settings.customWidth,
        customHeight: settings.customHeight,
        batchCount: settings.batchCount,
        isPublic: settings.isPublic === "true",
        cfgScale: settings.cfgScale,
        steps: settings.steps,
        negativePrompt: settings.negativePrompt,
        lastUpdated: settings.updatedAt,
      };

      return ResponseUtil.success(event, settingsResponse);
    } else {
      console.log(`ℹ️ No generation settings found for user: ${userId}`);
      // Return null to indicate no settings found - frontend can use defaults
      return ResponseUtil.success(event, null);
    }
  } catch (error) {
    console.error("Error getting generation settings:", error);
    return ResponseUtil.error(event, "Failed to get generation settings", 500);
  }
}

export const handler = LambdaHandlerUtil.withAuth(handleGetSettings, {
  requireBody: false,
});
