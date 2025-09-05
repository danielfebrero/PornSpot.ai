import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { S3Service } from "@shared/utils/s3";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { DownloadMediaZipRequest } from "@shared";
import archiver from "archiver";
import { PassThrough } from "stream";
import { v4 as uuidv4 } from "uuid";

const handleDownloadMediaZip = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  const { userId } = auth;

  // Parse request body
  let request: DownloadMediaZipRequest;
  try {
    request = LambdaHandlerUtil.parseJsonBody(event);
  } catch (error) {
    return ResponseUtil.badRequest(event, "Invalid JSON in request body");
  }

  // Validate request
  if (
    !request.mediaIds ||
    !Array.isArray(request.mediaIds) ||
    request.mediaIds.length === 0
  ) {
    return ResponseUtil.badRequest(
      event,
      "mediaIds array is required and cannot be empty"
    );
  }

  if (request.mediaIds.length > 50) {
    return ResponseUtil.badRequest(
      event,
      "Cannot download more than 50 media files at once"
    );
  }

  try {
    // Fetch all media entities
    const mediaEntities = await Promise.all(
      request.mediaIds.map(async (mediaId: string) => {
        const media = await DynamoDBService.findMediaById(mediaId);
        if (!media) {
          throw new Error(`Media with ID ${mediaId} not found`);
        }
        return media;
      })
    );

    // Check if user has access
    for (const media of mediaEntities) {
      const isOwner = media.createdBy === userId;
      const isPublic = media.isPublic === "true";

      if (!isOwner && !isPublic) {
        return ResponseUtil.forbidden(
          event,
          "You don't have access to one or more requested media files"
        );
      }
    }

    // Create zip archive + stream
    const archive = archiver("zip", { zlib: { level: 9 } });
    const pass = new PassThrough();
    archive.pipe(pass);

    const chunks: Buffer[] = [];
    const archivePromise = new Promise<Buffer>((resolve, reject) => {
      pass.on("data", (chunk: Buffer) => chunks.push(chunk));
      pass.on("end", () => resolve(Buffer.concat(chunks)));
      archive.on("error", reject);
    });

    // Add each media file to archive
    for (const media of mediaEntities) {
      try {
        if (media.url) {
          console.log(
            `Downloading media: ${media.id} (${media.originalFilename})`
          );

          const fileBuffer = await S3Service.downloadBuffer(media.filename);

          const zipEntryName = `${media.id}_${media.originalFilename}`;
          archive.append(fileBuffer, { name: zipEntryName });
        }
      } catch (error) {
        console.error(
          `Failed to download media ${media.id} with key ${media.filename}:`,
          error
        );
        // Skip this file, continue with others
      }
    }

    // Finalize archive
    await archive.finalize();

    // Wait for complete buffer
    const zipBuffer = await archivePromise;

    // Check size - if over 5MB, use S3
    const sizeInMB = zipBuffer.length / (1024 * 1024);
    console.log(`ZIP file size: ${sizeInMB.toFixed(2)} MB`);

    if (sizeInMB > 5) {
      // Upload to S3 temp bucket
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const tempKey = `temp-downloads/${userId}/${uuidv4()}-${timestamp}.zip`;

      await S3Service.uploadBuffer(tempKey, zipBuffer, "application/zip");

      // Generate pre-signed URL (expires in 1 hour)
      const presignedUrl = await S3Service.generatePresignedDownloadUrl(
        tempKey,
        3600
      );

      // Return URL instead of file
      return ResponseUtil.success(event, {
        downloadUrl: presignedUrl,
        expiresIn: 3600,
        filename: `media-download-${timestamp}.zip`,
        sizeInMB: sizeInMB.toFixed(2),
      });
    }

    // If under 5MB, return directly
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `media-download-${timestamp}.zip`;

    return ResponseUtil.binaryFile(
      event,
      zipBuffer,
      filename,
      "application/zip"
    );
  } catch (error) {
    console.error("Error creating zip download:", error);
    return ResponseUtil.error(event, "Failed to create zip download", 500);
  }
};

export const handler = LambdaHandlerUtil.withAuth(handleDownloadMediaZip, {
  requireAuth: true,
  requireBody: true,
});
