import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { S3Service } from "@shared/utils/s3";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { DownloadMediaZipRequest } from "@shared";
import archiver from "archiver";

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

    // Check if user has access to all media (owns them or they are public)
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

    // Create zip archive
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Maximum compression
    });

    const chunks: Buffer[] = [];

    // Set up archive data collection
    archive.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    // Handle archive errors
    archive.on("error", (err: Error) => {
      console.error("Archive error:", err);
      throw err;
    });

    // Download and add each media file to the archive
    for (const media of mediaEntities) {
      try {
        if (media.url) {
          console.log(
            `Downloading media: ${media.id} (${media.originalFilename})`
          );

          // Get the original file from S3 using downloadBuffer method
          const fileBuffer = await S3Service.downloadBuffer(media.url);

          // Use original filename for the zip entry, with media ID as prefix to avoid conflicts
          const zipEntryName = `${media.id}_${media.originalFilename}`;
          archive.append(fileBuffer, { name: zipEntryName });
        }
      } catch (error) {
        console.error(`Failed to download media ${media.id}:`, error);
        // Continue with other files rather than failing the entire request
      }
    }

    // Finalize the archive
    await archive.finalize();

    // Wait for archive to complete
    await new Promise<void>((resolve, reject) => {
      archive.on("end", resolve);
      archive.on("error", reject);
    });

    // Combine all chunks
    const zipBuffer = Buffer.concat(chunks);

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `media-download-${timestamp}.zip`;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": zipBuffer.length.toString(),
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
      },
      body: zipBuffer.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error("Error creating zip download:", error);
    return ResponseUtil.error(event, "Failed to create zip download", 500);
  }
};

export const handler = LambdaHandlerUtil.withAuth(handleDownloadMediaZip, {
  requireAuth: true,
  requireBody: true,
});
