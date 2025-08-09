import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { RevalidationService } from "@shared/utils/revalidation";
import {
  CreateCommentRequest,
  UpdateCommentRequest,
  CommentEntity,
} from "@shared";
import { v4 as uuidv4 } from "uuid";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";

const handleComment = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  console.log("🔄 Comment function called");

  const userId = auth.userId;

  // Route to appropriate handler based on HTTP method
  switch (event.httpMethod) {
    case "POST":
      return await createComment(event, userId);
    case "PUT":
      return await updateComment(event, userId);
    case "DELETE":
      return await deleteComment(event, userId);
    default:
      return ResponseUtil.error(event, "Method not allowed", 405);
  }
};

async function createComment(
  event: APIGatewayProxyEvent,
  userId: string
): Promise<APIGatewayProxyResult> {
  const request: CreateCommentRequest = LambdaHandlerUtil.parseJsonBody(event);
  
  // Validate input using shared utilities
  const targetType = ValidationUtil.validateRequiredString(request.targetType, "targetType");
  const targetId = ValidationUtil.validateRequiredString(request.targetId, "targetId");
  const content = ValidationUtil.validateRequiredString(request.content, "content");

  if (!["album", "media"].includes(targetType)) {
    return ResponseUtil.badRequest(
      event,
      "targetType must be 'album' or 'media'"
    );
  }

  if (content.trim().length === 0) {
    return ResponseUtil.badRequest(event, "Comment content cannot be empty");
  }

  if (content.trim().length > 500) {
    return ResponseUtil.badRequest(
      event,
      "Comment content must be 500 characters or less"
    );
  }

  // Get user data for username
  const user = await DynamoDBService.getUserById(userId);
  if (!user || !user.isActive) {
    return ResponseUtil.unauthorized(event, "User not found or inactive");
  }

  // Verify target exists
  if (targetType === "album") {
    const album = await DynamoDBService.getAlbum(targetId);
    if (!album) {
      return ResponseUtil.notFound(event, "Album not found");
    }
  } else {
    const media = await DynamoDBService.getMedia(targetId);
    if (!media) {
      return ResponseUtil.notFound(event, "Media not found");
    }
  }

  const now = new Date().toISOString();
  const commentId = uuidv4();

  // Create comment entity
  const commentEntity: CommentEntity = {
    PK: `COMMENT#${commentId}`,
    SK: "METADATA",
    GSI1PK: `COMMENTS_BY_TARGET#${targetType}#${targetId}`,
    GSI1SK: now,
    GSI2PK: `COMMENTS_BY_USER#${user.userId}`,
    GSI2SK: now,
    EntityType: "Comment",
    id: commentId,
    content: content.trim(),
    targetType,
    targetId,
    userId: user.userId,
    username: user.username,
    createdAt: now,
    updatedAt: now,
    likeCount: 0,
    isEdited: false,
  };

  // Create the comment
  await DynamoDBService.createComment(commentEntity);

  // Increment comment count for the target
  if (targetType === "album") {
    await DynamoDBService.incrementAlbumCommentCount(targetId, 1);
  } else {
    await DynamoDBService.incrementMediaCommentCount(targetId, 1);
  }

  // Trigger page revalidation for the target
  if (targetType === "media") {
    await RevalidationService.revalidateMedia(targetId);
  } else {
    await RevalidationService.revalidateAlbum(targetId);
  }

  console.log(`✅ Comment created for ${targetType} ${targetId}`);

  return ResponseUtil.success(event, {
    id: commentId,
    content: commentEntity.content,
    targetType,
    targetId,
    userId: user.userId,
    username: user.username,
    createdAt: now,
    updatedAt: now,
    likeCount: 0,
    isEdited: false,
  });
}

async function updateComment(
  event: APIGatewayProxyEvent,
  userId: string
): Promise<APIGatewayProxyResult> {
  // Get comment ID from path parameters
  const commentId = ValidationUtil.validateRequiredString(
    event.pathParameters?.["commentId"],
    "commentId"
  );

  const request: UpdateCommentRequest = LambdaHandlerUtil.parseJsonBody(event);
  
  // Validate input using shared utilities
  const content = ValidationUtil.validateRequiredString(request.content, "content");

  if (content.trim().length === 0) {
    return ResponseUtil.badRequest(event, "Comment content cannot be empty");
  }

  if (content.length > 1000) {
    return ResponseUtil.badRequest(
      event,
      "Comment content cannot exceed 1000 characters"
    );
  }

  // Get existing comment
  const existingComment = await DynamoDBService.getComment(commentId);
  if (!existingComment) {
    return ResponseUtil.notFound(event, "Comment not found");
  }

  // Check if user owns the comment
  if (existingComment.userId !== userId) {
    return ResponseUtil.forbidden(event, "You can only edit your own comments");
  }

  // Get user data for username
  const user = await DynamoDBService.getUserById(userId);
  if (!user || !user.isActive) {
    return ResponseUtil.unauthorized(event, "User not found or inactive");
  }

  const now = new Date().toISOString();

  // Update the comment
  await DynamoDBService.updateComment(commentId, {
    content: content.trim(),
    updatedAt: now,
    isEdited: true,
  });

  // Trigger page revalidation for the target
  if (existingComment.targetType === "media") {
    await RevalidationService.revalidateMedia(existingComment.targetId);
  } else {
    await RevalidationService.revalidateAlbum(existingComment.targetId);
  }

  console.log(`✅ Comment ${commentId} updated`);

  return ResponseUtil.success(event, {
    id: commentId,
    content: content.trim(),
    targetType: existingComment.targetType,
    targetId: existingComment.targetId,
    userId: user.userId,
    username: user.username,
    createdAt: existingComment.createdAt,
    updatedAt: now,
    likeCount: existingComment.likeCount,
    isEdited: true,
  });
}

async function deleteComment(
  event: APIGatewayProxyEvent,
  userId: string
): Promise<APIGatewayProxyResult> {
  // Get comment ID from path parameters
  const commentId = ValidationUtil.validateRequiredString(
    event.pathParameters?.["commentId"],
    "commentId"
  );

  // Get existing comment
  const existingComment = await DynamoDBService.getComment(commentId);
  if (!existingComment) {
    return ResponseUtil.notFound(event, "Comment not found");
  }

  // Check if user owns the comment
  if (existingComment.userId !== userId) {
    return ResponseUtil.forbidden(
      event,
      "You can only delete your own comments"
    );
  }

  // Delete the comment
  await DynamoDBService.deleteComment(commentId);

  // Decrement comment count for the target
  if (existingComment.targetType === "album") {
    await DynamoDBService.incrementAlbumCommentCount(
      existingComment.targetId,
      -1
    );
  } else {
    await DynamoDBService.incrementMediaCommentCount(
      existingComment.targetId,
      -1
    );
  }

  // Trigger page revalidation for the target
  if (existingComment.targetType === "media") {
    await RevalidationService.revalidateMedia(existingComment.targetId);
  } else {
    await RevalidationService.revalidateAlbum(existingComment.targetId);
  }

  console.log(`✅ Comment ${commentId} deleted`);

  return ResponseUtil.success(event, {
    id: commentId,
    message: "Comment deleted successfully",
  });
}

export const handler = LambdaHandlerUtil.withAuth(handleComment, {
  requireBody: ["POST", "PUT"],
  validatePathParams: ["PUT", "DELETE"],
  pathParamNames: ["commentId"]
});
