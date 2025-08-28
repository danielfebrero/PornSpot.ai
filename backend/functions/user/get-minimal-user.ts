import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";
import { MinimalUser } from "@shared";

interface GetMinimalUserResponse {
  user: MinimalUser;
}

const handleGetMinimalUser = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("🔍 /user/get-minimal-user handler called");

  // Only allow GET method
  if (event.httpMethod !== "GET") {
    console.log("❌ Method not allowed:", event.httpMethod);
    return ResponseUtil.methodNotAllowed(event, "Only GET method allowed");
  }

  // Get userId or username from query parameters
  const userId = event.queryStringParameters?.["userId"];
  const username = event.queryStringParameters?.["username"];

  // Validate that at least one parameter is provided
  if (!userId && !username) {
    console.log("❌ Missing required parameters");
    return ResponseUtil.badRequest(
      event,
      "Either userId or username parameter is required"
    );
  }

  console.log("🔍 Looking up user by:", { userId, username });

  let userEntity;

  try {
    // Get user by userId or username
    if (userId) {
      // Validate userId format
      const validatedUserId = ValidationUtil.validateRequiredString(
        userId,
        "userId"
      );
      console.log("🔍 Getting user by userId:", validatedUserId);
      userEntity = await DynamoDBService.getUserById(validatedUserId);
    } else if (username) {
      // Validate username format
      const validatedUsername = ValidationUtil.validateUsername(username);
      console.log("🔍 Getting user by username:", validatedUsername);
      userEntity = await DynamoDBService.getUserByUsername(validatedUsername);
    }

    if (!userEntity) {
      console.log("❌ User not found");
      return ResponseUtil.notFound(event, "User not found");
    }

    // Check if user is active
    if (!userEntity.isActive) {
      console.log("❌ User is inactive:", userEntity.userId);
      return ResponseUtil.notFound(event, "User not found");
    }

    console.log("✅ Found user:", userEntity.userId, userEntity.username);

    // Prepare minimal user response (only public information)
    const minimalUser: MinimalUser = {
      userId: userEntity.userId,
      username: userEntity.username,
      ...(userEntity.avatarUrl && { avatarUrl: userEntity.avatarUrl }),
      ...(userEntity.avatarThumbnails && {
        avatarThumbnails: {
          originalSize: userEntity.avatarThumbnails.originalSize,
          small: userEntity.avatarThumbnails.small,
          medium: userEntity.avatarThumbnails.medium,
          large: userEntity.avatarThumbnails.large,
        },
      }),
    };

    console.log(
      "✅ Returning minimal user for:",
      userEntity.username || userEntity.userId
    );

    const response: GetMinimalUserResponse = {
      user: minimalUser,
    };

    return ResponseUtil.success(event, response);
  } catch (error) {
    console.error("❌ Error getting minimal user:", error);
    if (error instanceof Error && error.message.includes("validation")) {
      return ResponseUtil.badRequest(event, error.message);
    }
    return ResponseUtil.error(event, "Failed to get user");
  }
};

export const handler = LambdaHandlerUtil.withoutAuth(handleGetMinimalUser);
