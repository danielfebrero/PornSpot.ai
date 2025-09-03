import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { PublicUserProfile } from "@shared";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";

interface GetPublicProfileResponse {
  user: PublicUserProfile;
}

const handleGetUserProfile = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  console.log("🔍 /user/profile/get handler called");

  // Only allow GET method
  if (event.httpMethod !== "GET") {
    console.log("❌ Method not allowed:", event.httpMethod);
    return ResponseUtil.methodNotAllowed(event, "Only GET method allowed");
  }

  const currentUserId = auth.userId;
  console.log("✅ Authenticated user:", currentUserId);

  // Get username from query parameter
  const username = ValidationUtil.validateRequiredString(
    event.queryStringParameters?.["username"],
    "username"
  );

  console.log("🔍 Looking up user by username:", username);

  // Get user by username
  const userEntity = await DynamoDBService.getUserByUsername(username);
  if (!userEntity) {
    console.log("❌ User not found with username:", username);
    return ResponseUtil.notFound(event, "User not found");
  }

  // Check if user is active
  if (!userEntity.isActive) {
    console.log("❌ User is inactive:", username);
    return ResponseUtil.notFound(event, "User not found");
  }

  console.log("✅ Found user:", userEntity.userId, userEntity.email);

  // Check follow relationships
  const [isFollowedByCurrentUser, isFollowingCurrentUser] = await Promise.all([
    // Check if current user follows the target user
    DynamoDBService.getFollowRelationship(currentUserId, userEntity.userId),
    // Check if target user follows the current user
    DynamoDBService.getFollowRelationship(userEntity.userId, currentUserId),
  ]);

  console.log("🔍 Follow relationships:", {
    currentUserFollowsTarget: !!isFollowedByCurrentUser,
    targetUserFollowsCurrent: !!isFollowingCurrentUser,
  });

  // Prepare public profile response (excluding sensitive information)
  const publicProfile: PublicUserProfile = {
    userId: userEntity.userId,
    username: userEntity.username,
    createdAt: userEntity.createdAt,
    ...(userEntity.lastActive && { lastActive: userEntity.lastActive }),
    isActive: userEntity.isActive,
    isEmailVerified: userEntity.isEmailVerified,
    ...(userEntity.lastLoginAt && { lastLoginAt: userEntity.lastLoginAt }),
    ...(userEntity.bio && { bio: userEntity.bio }),
    ...(userEntity.location && { location: userEntity.location }),
    ...(userEntity.website && { website: userEntity.website }),
    ...(userEntity.avatarUrl && { avatarUrl: userEntity.avatarUrl }),
    ...(userEntity.avatarThumbnails && {
      avatarThumbnails: userEntity.avatarThumbnails,
    }),
    ...(userEntity.profileInsights && {
      profileInsights: userEntity.profileInsights,
    }),
    planInfo: {
      plan: userEntity.plan,
    },
    // Follow relationship fields
    isFollowed: !!isFollowedByCurrentUser,
    isFollowing: !!isFollowingCurrentUser,
    followerCount: userEntity.followerCount || 0,
  };

  console.log("✅ Returning public profile for user:", username);

  const response: GetPublicProfileResponse = {
    user: publicProfile,
  };

  return ResponseUtil.success(event, response);
};

export const handler = LambdaHandlerUtil.withAuth(handleGetUserProfile, {
  validateQueryParams: ["username"],
});
