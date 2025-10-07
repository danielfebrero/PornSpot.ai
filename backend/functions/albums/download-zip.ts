/**
 * @fileoverview Album ZIP Download Handler
 * @description Creates a ZIP archive of all media files in an album and provides a presigned S3 URL for download.
 * @auth Requires authentication via LambdaHandlerUtil.withAuth.
 * @param albumId: Album ID from path parameter
 * @notes
 * - Validates album access (owner or public).
 * - Fetches all media in the album.
 * - Uses archiver to create ZIP in memory.
 * - If >5MB, uploads to S3 temp bucket and generates presigned URL (1 hour expiry).
 * - Appends original filenames with ID prefix.
 * - Returns downloadUrl, expiresIn, filename, sizeInMB.
 * - Skips failed downloads, continues with others.
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { S3Service } from "@shared/utils/s3";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";
import archiver from "archiver";
import { PassThrough } from "stream";
import { v4 as uuidv4 } from "uuid";

const handleDownloadAlbumZip = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  const { userId } = auth;

  // Get album ID from path parameters
  const albumId = ValidationUtil.validateRequiredString(
    event.pathParameters?.["albumId"],
    "albumId"
  );

  try {
    // Fetch album to check access
    const album = await DynamoDBService.getAlbum(albumId);
    if (!album) {
      return ResponseUtil.notFound(event, "Album not found");
    }

    // Check if user has access
    const isOwner = album.createdBy === userId;
    const isPublic = album.isPublic === true;

    if (!isOwner && !isPublic) {
      return ResponseUtil.forbidden(
        event,
        "You don't have access to this album"
      );
    }

    // Fetch all media in the album (with high limit to get all media)
    const { media: albumMedia } = await DynamoDBService.listAlbumMedia(
      albumId,
      1000 // High limit to get all media in album
    );

    if (!albumMedia || albumMedia.length === 0) {
      return ResponseUtil.badRequest(event, "Album has no media to download");
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
    for (const media of albumMedia) {
      try {
        if (media.url) {
          console.log(
            `Downloading media: ${media.id} (${media.originalFilename})`
          );

          const fileBuffer = await S3Service.downloadBuffer(media.filename);

          // Extract file extension from media.filename
          const fileExtension = media.filename.split(".").pop() || "";
          const zipEntryName = `${media.id}_${media.originalFilename}${
            fileExtension ? "." + fileExtension : ""
          }`;
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
      filename: `${album.title || "album"}-${timestamp}.zip`,
      sizeInMB: sizeInMB.toFixed(2),
    });
  } catch (error) {
    console.error("Failed to download album as zip:", error);
    return ResponseUtil.error(
      event,
      error instanceof Error ? error.message : "Internal server error"
    );
  }
};

export const handler = LambdaHandlerUtil.withAuth(handleDownloadAlbumZip, {
  validatePathParams: ["albumId"],
});
