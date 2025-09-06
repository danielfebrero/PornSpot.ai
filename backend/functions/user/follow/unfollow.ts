/**
 * @fileoverview User Unfollow Handler
 * @description Allows authenticated user to unfollow another user, removing relationship and decrementing count.
 * @auth Requires authentication via LambdaHandlerUtil.withAuth.
 * @queryParams {string} username - Username to unfollow.
 * @notes
 * - Validates username, checks not self-unfollow.
 * - Checks existing follow.
 * - Deletes follow relationship, decrements follower count.
 * - Returns success message.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";

interface UnfollowUserResponse {
  message: string;
}

const handleUnfollowUser = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  console.log("👥 /user/unfollow handler called");

  // Only allow DELETE method
  if (event.httpMethod !== "DELETE") {
    console.log("❌ Method not allowed:", event.httpMethod);
    return ResponseUtil.methodNotAllowed(event, "Only DELETE method allowed");
  }

  const followerId = auth.userId;

  // Get username from query parameters
  const username = event.queryStringParameters?.["username"];
  if (!username) {
    console.log("❌ Missing username parameter");
    return ResponseUtil.badRequest(event, "Username parameter is required");
  }

  console.log("👥 User unfollowing:", { followerId, username });

  try {
    // Validate username
    const validatedUsername = ValidationUtil.validateRequiredString(
      username,
      "username"
    );

    // Get the user to unfollow by username
    const userToUnfollow = await DynamoDBService.getUserByUsername(
      validatedUsername
    );
    if (!userToUnfollow) {
      console.log("❌ User not found:", validatedUsername);
      return ResponseUtil.notFound(event, "User not found");
    }

    const followedId = userToUnfollow.userId;

    // Check if user is trying to unfollow themselves
    if (followerId === followedId) {
      console.log("❌ User trying to unfollow themselves");
      return ResponseUtil.badRequest(event, "You cannot unfollow yourself");
    }

    // Check if follow relationship exists
    const existingFollow = await DynamoDBService.getFollowRelationship(
      followerId,
      followedId
    );
    if (!existingFollow) {
      console.log("❌ Not following user");
      return ResponseUtil.badRequest(event, "You are not following this user");
    }

    // Delete follow relationship and decrement follower count
    await Promise.all([
      DynamoDBService.deleteFollowRelationship(followerId, followedId),
      DynamoDBService.decrementUserFollowerCount(followedId),
    ]);

    console.log("✅ Successfully unfollowed user:", { followerId, followedId });

    const response: UnfollowUserResponse = {
      message: `You are no longer following ${userToUnfollow.username}`,
    };

    return ResponseUtil.success(event, response);
  } catch (error) {
    console.error("❌ Error unfollowing user:", error);
    return ResponseUtil.error(
      event,
      error instanceof Error ? error.message : "Failed to unfollow user"
    );
  }
};

export const handler = LambdaHandlerUtil.withAuth(handleUnfollowUser);
