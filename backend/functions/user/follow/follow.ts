import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";
import { NotificationTargetType } from "@shared";

interface FollowUserResponse {
  message: string;
}

const handleFollowUser = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  console.log("👥 /user/follow handler called");

  // Only allow POST method
  if (event.httpMethod !== "POST") {
    console.log("❌ Method not allowed:", event.httpMethod);
    return ResponseUtil.methodNotAllowed(event, "Only POST method allowed");
  }

  const followerId = auth.userId;

  // Get username from query parameters
  const username = event.queryStringParameters?.["username"];
  if (!username) {
    console.log("❌ Missing username parameter");
    return ResponseUtil.badRequest(event, "Username parameter is required");
  }

  console.log("👥 User following:", { followerId, username });

  try {
    // Validate username
    const validatedUsername = ValidationUtil.validateRequiredString(
      username,
      "username"
    );

    // Get the user to follow by username
    const userToFollow = await DynamoDBService.getUserByUsername(
      validatedUsername
    );
    if (!userToFollow) {
      console.log("❌ User not found:", validatedUsername);
      return ResponseUtil.notFound(event, "User not found");
    }

    const followedId = userToFollow.userId;

    // Check if user is trying to follow themselves
    if (followerId === followedId) {
      console.log("❌ User trying to follow themselves");
      return ResponseUtil.badRequest(event, "You cannot follow yourself");
    }

    // Check if already following
    const existingFollow = await DynamoDBService.getFollowRelationship(
      followerId,
      followedId
    );
    if (existingFollow) {
      console.log("❌ Already following user");
      return ResponseUtil.badRequest(
        event,
        "You are already following this user"
      );
    }

    // Create follow relationship and increment follower count
    await Promise.all([
      DynamoDBService.createFollowRelationship(followerId, followedId),
      DynamoDBService.incrementUserFollowerCount(followedId),
    ]);

    console.log("✅ Successfully followed user:", { followerId, followedId });

    try {
      await DynamoDBService.createNotification(
        followedId,
        followerId,
        "follow",
        "user" as NotificationTargetType,
        followedId
      );
      console.log(`📬 Created follow notification for user ${followedId}`);
    } catch (error) {
      console.warn(`⚠️ Failed to create like notification:`, error);
    }

    const response: FollowUserResponse = {
      message: `Successfully followed ${username}`,
    };

    return ResponseUtil.success(event, response);
  } catch (error) {
    console.error("❌ Error following user:", error);
    return ResponseUtil.error(
      event,
      error instanceof Error ? error.message : "Failed to follow user"
    );
  }
};

export const handler = LambdaHandlerUtil.withAuth(handleFollowUser);
