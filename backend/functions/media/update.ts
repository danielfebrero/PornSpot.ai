import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { RevalidationService } from "@shared/utils/revalidation";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { MediaEntity } from "@shared";

interface UpdateMediaRequest {
  title?: string;
  isPublic?: boolean;
  // Add other updatable fields as needed
}

const handleUpdateMedia = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  const { userId } = auth;
  const mediaId = LambdaHandlerUtil.getPathParam(event, "mediaId");

  // Parse request body
  let requestBody: UpdateMediaRequest;
  try {
    requestBody = JSON.parse(event.body || "{}");
  } catch (error) {
    return ResponseUtil.badRequest(event, "Invalid JSON in request body");
  }

  // Check if media exists
  const existingMedia = await DynamoDBService.getMedia(mediaId);
  if (!existingMedia) {
    return ResponseUtil.notFound(event, "Media not found");
  }

  if (!existingMedia.createdBy) {
    return ResponseUtil.badRequest(
      event,
      "Media ownership information is missing"
    );
  }

  // Check if user owns the media (or use helper for admin override)
  if (
    !LambdaHandlerUtil.checkOwnershipOrAdmin(
      existingMedia.createdBy,
      userId,
      auth.userRole
    )
  ) {
    return ResponseUtil.forbidden(event, "You can only update your own media");
  }

  console.log("📝 Updating media:", {
    mediaId,
    filename: existingMedia.filename,
    createdBy: existingMedia.createdBy,
    updates: requestBody,
  });

  // Prepare update data
  const updateData: Partial<MediaEntity> = {
    updatedAt: new Date().toISOString(),
  };

  // Handle title update
  if (requestBody.title !== undefined) {
    updateData.originalFilename = requestBody.title;
  }

  // Handle visibility update
  if (requestBody.isPublic !== undefined) {
    updateData.isPublic = requestBody.isPublic ? "true" : "false";
  }

  // Update media in DynamoDB
  await DynamoDBService.updateMedia(mediaId, updateData);

  // Retrieve updated media entity
  const updatedMediaEntity = await DynamoDBService.findMediaById(mediaId);
  if (!updatedMediaEntity) {
    return ResponseUtil.notFound(event, "Media not found after update");
  }

  // Convert to response format
  const mediaResponse =
    DynamoDBService.convertMediaEntityToMedia(updatedMediaEntity);

  // Trigger revalidation for affected pages
  try {
    await RevalidationService.revalidateMedia(mediaId);
  } catch (error) {
    console.warn("Failed to revalidate media:", error);
    // Don't fail the request if revalidation fails
  }

  console.log("✅ Media updated successfully:", {
    mediaId,
    updatedFields: Object.keys(updateData),
  });

  return ResponseUtil.success(event, mediaResponse);
};

export const handler = LambdaHandlerUtil.withAuth(handleUpdateMedia, {
  requireBody: true,
  validatePathParams: ["mediaId"],
  includeRole: true,
});
