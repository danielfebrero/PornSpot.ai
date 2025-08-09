import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { S3Service } from "@shared/utils/s3";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";

interface AvatarUploadRequest {
  filename: string;
  contentType: string;
}

interface AvatarUploadResponse {
  uploadUrl: string;
  avatarKey: string;
}

const handleAvatarUpload = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  console.log("🔍 /user/profile/avatar/upload handler called");

  // Only allow POST method
  if (event.httpMethod !== "POST") {
    console.log("❌ Method not allowed:", event.httpMethod);
    return ResponseUtil.methodNotAllowed(event, "Only POST method allowed");
  }

  console.log("✅ Authenticated user:", auth.userId);

  const uploadRequest: AvatarUploadRequest = LambdaHandlerUtil.parseJsonBody(event);

  console.log("📝 Avatar upload request:", uploadRequest);

  // Validate input data using shared validation
  const filename = ValidationUtil.validateRequiredString(uploadRequest.filename, "Filename");
  const contentType = ValidationUtil.validateRequiredString(uploadRequest.contentType, "Content type");

  // Validate file type - only allow image files
  if (!contentType.startsWith("image/")) {
    return ResponseUtil.badRequest(event, "Only image files are allowed for avatars");
  }

  // Validate supported image types
  const supportedTypes = [
    "image/jpeg",
    "image/jpg", 
    "image/png",
    "image/webp",
  ];
  if (!supportedTypes.includes(contentType)) {
    return ResponseUtil.badRequest(
      event,
      `Unsupported image type. Supported types: ${supportedTypes.join(", ")}`
    );
  }

  // Generate presigned upload URL using S3Service
  console.log("🔑 Generating presigned upload URL for avatar");
  const { uploadUrl, key: avatarKey } =
    await S3Service.generateAvatarPresignedUploadUrl(
      auth.userId,
      filename,
      contentType
    );

  console.log(`✅ Generated presigned upload URL for user ${auth.userId} avatar`);

  const response: AvatarUploadResponse = {
    uploadUrl,
    avatarKey,
  };

  return ResponseUtil.success(event, response);
};

export const handler = LambdaHandlerUtil.withAuth(handleAvatarUpload, {
  requireBody: true,
});
