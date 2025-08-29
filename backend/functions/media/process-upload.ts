/*
File objective: S3 event processor to generate thumbnails and persist metadata for uploads.
Trigger: S3 (not API Gateway). Handles avatar uploads, album media uploads, and AI-generated media; skips existing thumbnails.
Special notes:
- Dynamically imports Sharp (platform-specific) with explicit error if unavailable
- LocalStack-aware S3 client configuration (endpoint, forcePathStyle)
- Avatar uploads: generate avatar thumbnails and update user entity
- Media uploads: convert to WebP when appropriate, create multi-size thumbnails, persist Media entity, revalidate caches
- Generated media: process AI-generated images, create thumbnails, update Media entity status to 'uploaded'
- Robust logging with per-record isolation; continues on per-record failures
*/
import { S3Event, S3EventRecord } from "aws-lambda";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ThumbnailService } from "@shared/utils/thumbnail";
import { AvatarThumbnailService } from "@shared/utils/avatar-thumbnail";
import { RevalidationService } from "@shared/utils/revalidation";
import { S3Service } from "@shared/utils/s3";
import { Readable } from "stream";
import { MediaEntity } from "@shared";

// Dynamically import Sharp to handle platform-specific binaries
let sharp: typeof import("sharp");

const loadSharp = async () => {
  if (!sharp) {
    try {
      sharp = (await import("sharp")).default;
      console.log("Sharp module loaded successfully in process-upload");
    } catch (error) {
      console.error("Failed to load Sharp module:", error);
      throw new Error(
        "Sharp module not available. Please ensure Sharp is installed with the correct platform binaries for Lambda (linux-x64)."
      );
    }
  }
  return sharp;
};

/**
 * Determine if a MIME type should be converted to WebP
 */
const shouldConvertToWebP = (mimeType: string): boolean => {
  const convertibleTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
  ];
  return (
    convertibleTypes.includes(mimeType.toLowerCase()) &&
    mimeType !== "image/webp"
  );
};

const isLocal = process.env["AWS_SAM_LOCAL"] === "true";

let s3Config = {};
if (isLocal) {
  s3Config = {
    endpoint: "http://pornspot-local-aws:4566",
    region: process.env["AWS_REGION"] || "us-east-1",
    credentials: {
      accessKeyId: "test",
      secretAccessKey: "test",
    },
    forcePathStyle: true,
  };
}

const s3Client = new S3Client(s3Config);

export const handler = async (event: S3Event): Promise<void> => {
  // Lambda invocation logging
  console.log("[process-upload] Lambda started");
  // Log event with minimal redaction (S3 event: no secrets by default)
  // If you add secrets to S3 event, redact here.
  try {
    console.log(
      "[process-upload] Received event:",
      JSON.stringify(event, null, 2)
    );

    for (const record of event.Records) {
      try {
        await processUploadRecord(record);
      } catch (error) {
        console.error(
          "[process-upload] Error processing record:",
          record,
          error
        );
        // Continue processing other records
      }
    }

    console.log(
      "[process-upload] Lambda completed successfully for",
      event.Records.length,
      "record(s)"
    );
  } catch (err) {
    // Robust error/exception logging with stack trace
    if (err instanceof Error) {
      console.error("[process-upload] Lambda failed:", err.message, err.stack);
    } else {
      console.error(
        "[process-upload] Lambda failed with non-Error exception:",
        err
      );
    }
    throw err;
  }
};

async function processUploadRecord(record: S3EventRecord): Promise<void> {
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

  console.log(`Processing uploaded file: ${key}`);

  // Skip if this is already a thumbnail
  if (
    key.includes("/thumbnails/") ||
    key.includes("original.webp") ||
    key.includes("_display.webp")
  ) {
    console.log(
      "Skipping thumbnail file or original webp file or _display.webp"
    );
    return;
  }

  // Determine upload type based on key pattern
  const keyParts = key.split("/");

  if (
    keyParts.length >= 4 &&
    keyParts[0] === "users" &&
    keyParts[2] === "avatar"
  ) {
    // Avatar upload: users/{userId}/avatar/{filename}
    await processAvatarUpload(record, key, keyParts);
  } else if (
    keyParts.length >= 4 &&
    keyParts[0] === "albums" &&
    keyParts[2] === "media"
  ) {
    // Media upload: albums/{albumId}/media/{filename}
    await processMediaUpload(record, key, keyParts);
  } else if (keyParts.length >= 3 && keyParts[0] === "generated") {
    // Generated media upload: generated/{generationId}/{filename}
    await processGeneratedMediaUpload(record, key, keyParts);
  } else {
    console.log("Unknown key format, skipping:", key);
    return;
  }
}

async function processAvatarUpload(
  record: S3EventRecord,
  key: string,
  keyParts: string[]
): Promise<void> {
  const userId = keyParts[1];
  const filename = keyParts[3];

  if (!userId || !filename) {
    console.log("No user ID or filename found in avatar key:", key);
    return;
  }

  console.log(`Processing avatar for user: ${userId}, file: ${filename}`);

  // Get the file from S3
  const getObjectCommand = new GetObjectCommand({
    Bucket: record.s3.bucket.name,
    Key: key,
  });

  try {
    const response = await s3Client.send(getObjectCommand);
    if (!response.Body) {
      console.log("No body in S3 response");
      return;
    }

    // Get metadata to determine content type
    const contentType = response.ContentType || "image/jpeg";

    console.log(`Avatar content type: ${contentType}`);

    // Validate that it's an image
    if (!contentType.startsWith("image/")) {
      console.log("Not an image file, skipping avatar processing");
      return;
    }

    // Convert stream to buffer
    const chunks: Buffer[] = [];
    const stream = response.Body as Readable;

    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }

    const buffer = Buffer.concat(chunks);

    // Generate avatar thumbnails
    const thumbnailUrls = await AvatarThumbnailService.generateAvatarThumbnails(
      buffer,
      userId,
      contentType
    );

    // Update user entity with avatar information
    await updateUserAvatar(userId, key, thumbnailUrls);

    console.log(`✅ Successfully processed avatar for user: ${userId}`);
  } catch (error) {
    console.error(`❌ Failed to process avatar for user ${userId}:`, error);
    throw error;
  }
}

async function processMediaUpload(
  record: S3EventRecord,
  key: string,
  keyParts: string[]
): Promise<void> {
  const bucket = record.s3.bucket.name;
  const albumId = keyParts[1];

  if (!albumId) {
    console.log("No album ID found in key:", key);
    return;
  }

  // Find the media record by filename
  const mediaResult = await DynamoDBService.listAlbumMedia(albumId, 100);
  const mediaItem = mediaResult.media.find((m) => m.filename === key);

  if (!mediaItem || !mediaItem.id) {
    console.log("Media record not found for key:", key);
    return;
  }

  // Get the file from S3
  const getObjectCommand = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const response = await s3Client.send(getObjectCommand);
  if (!response.Body) {
    console.log("No body in S3 response");
    return;
  }

  // Convert stream to buffer
  const chunks: Buffer[] = [];
  const stream = response.Body as Readable;

  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }

  const buffer = Buffer.concat(chunks);

  // Check if it's an image and process accordingly
  if (ThumbnailService.isImageFile(mediaItem.mimeType)) {
    console.log("Processing image file:", key);

    try {
      // Generate thumbnails using the original buffer (thumbnails will be WebP)
      const thumbnailUrls = await ThumbnailService.generateThumbnails(
        key,
        buffer
      );

      // Create WebP version of original for lightbox display (if convertible)
      let webpUrl: string | undefined;
      if (shouldConvertToWebP(mediaItem.mimeType)) {
        console.log("Creating WebP version for lightbox display:", key);

        const sharpInstance = await loadSharp();
        const webpBuffer = await sharpInstance(buffer)
          .webp({ quality: 95 }) // High quality for lightbox
          .toBuffer();

        // Create WebP key by changing extension
        const keyParts = key.split(".");
        let webpKey: string;
        if (keyParts.length > 1) {
          keyParts[keyParts.length - 1] = "webp";
          webpKey = keyParts.join(".");
        } else {
          webpKey = `${key}.webp`;
        }

        // Add "display" suffix to distinguish from original
        const pathParts = webpKey.split("/");
        const filename = pathParts[pathParts.length - 1];
        if (filename) {
          const filenameParts = filename.split(".");
          if (filenameParts.length > 1) {
            filenameParts[filenameParts.length - 2] += "_display";
            pathParts[pathParts.length - 1] = filenameParts.join(".");
            webpKey = pathParts.join("/");
          }
        }

        // Upload WebP version for display
        await S3Service.uploadBuffer(webpKey, webpBuffer, "image/webp", {
          "original-key": key,
          purpose: "lightbox-display",
        });

        webpUrl = S3Service.getRelativePath(webpKey);
        console.log("Created WebP display version:", webpUrl);
      }

      if (thumbnailUrls && Object.keys(thumbnailUrls).length > 0) {
        // Update the media record with thumbnail URLs and WebP display URL
        const updateData: Partial<MediaEntity> = {
          thumbnailUrl:
            thumbnailUrls["small"] || Object.values(thumbnailUrls)[0], // Default to small (240px) or first available
          thumbnailUrls: {
            ...thumbnailUrls,
            // Add WebP display URL as originalSize if created
            ...(webpUrl && { originalSize: webpUrl }),
          },
          status: "uploaded" as const,
          updatedAt: new Date().toISOString(),
        };

        await DynamoDBService.updateMedia(mediaItem.id!, updateData);

        console.log(
          "Updated media record with thumbnail URLs:",
          Object.keys(thumbnailUrls).join(", ")
        );
        if (webpUrl) {
          console.log("Added WebP display URL for lightbox");
        }
      } else {
        // Just update status and WebP URL if thumbnail generation failed
        const updateData: Partial<MediaEntity> = {
          status: "uploaded" as const,
          updatedAt: new Date().toISOString(),
        };

        // Add WebP display URL as originalSize if created
        if (webpUrl) {
          updateData.thumbnailUrls = {
            ...mediaItem.thumbnailUrls,
            originalSize: webpUrl,
          };
        }

        await DynamoDBService.updateMedia(mediaItem.id!, updateData);

        console.log("Thumbnail generation failed, updated status only");
        if (webpUrl) {
          console.log("Added WebP display URL as originalSize thumbnail");
        }
      }
    } catch (error) {
      console.error("Error processing image:", error);

      // Update status even if processing failed
      await DynamoDBService.updateMedia(mediaItem.id!, {
        status: "uploaded" as const,
        updatedAt: new Date().toISOString(),
      });
    }
  } else {
    console.log("Not an image file, updating status only");

    // For non-image files, just update the status
    await DynamoDBService.updateMedia(mediaItem.id!, {
      status: "uploaded" as const,
      updatedAt: new Date().toISOString(),
    });
  }

  // Trigger revalidation for the album containing this media
  try {
    await RevalidationService.revalidateAlbum(albumId);
  } catch (error) {
    console.error(
      "Error triggering revalidation after media processing:",
      error
    );
    // Don't fail the entire operation if revalidation fails
  }
}

async function processGeneratedMediaUpload(
  record: S3EventRecord,
  key: string,
  keyParts: string[]
): Promise<void> {
  const bucket = record.s3.bucket.name;
  const generationId = keyParts[1];
  const filename = keyParts[2];

  if (!generationId || !filename) {
    console.log("No generation ID or filename found in generated key:", key);
    return;
  }

  // Extract media ID from filename
  // Generated media follows pattern: {imageId}_{imageIndex}.{extension}
  // Media ID follows pattern: {generationId}_{imageIndex}
  const filenameParts = filename.split(".");
  const baseFilename = filenameParts[0]; // Remove extension

  if (!baseFilename) {
    console.log("Could not extract base filename from:", filename);
    return;
  }

  const imageIndexMatch = baseFilename.match(/_(\d+)$/);

  if (!imageIndexMatch) {
    console.log("Could not extract image index from filename:", filename);
    return;
  }

  const imageIndex = imageIndexMatch[1];
  const mediaId = `${generationId}_${imageIndex}`;

  console.log(`Processing generated media: ${mediaId}, file: ${filename}`);

  // Find the media record by media ID
  const mediaEntity = await DynamoDBService.findMediaById(mediaId);

  if (!mediaEntity) {
    console.log("Generated media record not found for ID:", mediaId);
    return;
  }

  // Get the file from S3
  const getObjectCommand = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const response = await s3Client.send(getObjectCommand);
  if (!response.Body) {
    console.log("No body in S3 response");
    return;
  }

  // Convert stream to buffer
  const chunks: Buffer[] = [];
  const stream = response.Body as Readable;

  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }

  const buffer = Buffer.concat(chunks);

  // Check if it's an image and process accordingly
  if (ThumbnailService.isImageFile(mediaEntity.mimeType)) {
    console.log("Processing generated image file:", key);

    try {
      // Generate thumbnails using the original buffer (thumbnails will be WebP)
      const thumbnailUrls = await ThumbnailService.generateThumbnails(
        key,
        buffer
      );

      // Create WebP version of original for lightbox display (if convertible)
      let webpUrl: string | undefined;
      if (shouldConvertToWebP(mediaEntity.mimeType)) {
        console.log("Creating WebP version for lightbox display:", key);

        const sharpInstance = await loadSharp();
        const webpBuffer = await sharpInstance(buffer)
          .webp({ quality: 95 }) // High quality for lightbox
          .toBuffer();

        // Create WebP key by changing extension
        const keyParts = key.split(".");
        let webpKey: string;
        if (keyParts.length > 1) {
          keyParts[keyParts.length - 1] = "webp";
          webpKey = keyParts.join(".");
        } else {
          webpKey = `${key}.webp`;
        }

        // Add "display" suffix to distinguish from original
        const pathParts = webpKey.split("/");
        const filename = pathParts[pathParts.length - 1];
        if (filename) {
          const filenameParts = filename.split(".");
          if (filenameParts.length > 1) {
            filenameParts[filenameParts.length - 2] += "_display";
            pathParts[pathParts.length - 1] = filenameParts.join(".");
            webpKey = pathParts.join("/");
          }
        }

        // Upload WebP version for display
        await S3Service.uploadBuffer(webpKey, webpBuffer, "image/webp", {
          "original-key": key,
          purpose: "lightbox-display",
        });

        webpUrl = S3Service.getRelativePath(webpKey);
        console.log("Created WebP display version:", webpUrl);
      }

      if (thumbnailUrls && Object.keys(thumbnailUrls).length > 0) {
        // Update the media record with thumbnail URLs and WebP display URL
        const updateData: Partial<MediaEntity> = {
          thumbnailUrl:
            thumbnailUrls["small"] || Object.values(thumbnailUrls)[0], // Default to small (240px) or first available
          thumbnailUrls: {
            ...thumbnailUrls,
            // Add WebP display URL as originalSize if created
            ...(webpUrl && { originalSize: webpUrl }),
          },
          status: "uploaded" as const,
          updatedAt: new Date().toISOString(),
        };

        await DynamoDBService.updateMedia(mediaEntity.id!, updateData);

        console.log(
          "Updated generated media record with thumbnail URLs:",
          Object.keys(thumbnailUrls).join(", ")
        );
        if (webpUrl) {
          console.log("Added WebP display URL for lightbox");
        }
      } else {
        // Just update status and WebP URL if thumbnail generation failed
        const updateData: Partial<import("@shared").MediaEntity> = {
          status: "uploaded" as const,
          updatedAt: new Date().toISOString(),
        };

        // Add WebP display URL as originalSize if created
        if (webpUrl) {
          updateData.thumbnailUrls = {
            ...mediaEntity.thumbnailUrls,
            originalSize: webpUrl,
          };
        }

        await DynamoDBService.updateMedia(mediaEntity.id!, updateData);

        console.log("Thumbnail generation failed, updated status only");
        if (webpUrl) {
          console.log("Added WebP display URL as originalSize thumbnail");
        }
      }
    } catch (error) {
      console.error("Error processing generated image:", error);

      // Update status even if processing failed
      await DynamoDBService.updateMedia(mediaEntity.id!, {
        status: "uploaded" as const,
        updatedAt: new Date().toISOString(),
      });
    }
  } else {
    console.log("Not an image file, updating status only");

    // For non-image files, just update the status
    await DynamoDBService.updateMedia(mediaEntity.id!, {
      status: "uploaded" as const,
      updatedAt: new Date().toISOString(),
    });
  }

  console.log(`✅ Successfully processed generated media: ${mediaId}`);
}

/**
 * Update user entity with avatar information
 */
async function updateUserAvatar(
  userId: string,
  avatarUrl: string,
  thumbnailUrls: {
    originalSize?: string;
    small?: string;
    medium?: string;
    large?: string;
  }
): Promise<void> {
  try {
    await DynamoDBService.updateUser(userId, {
      avatarUrl,
      avatarThumbnails: thumbnailUrls,
    });
    console.log(`✅ Updated user ${userId} with avatar information`);
  } catch (error) {
    console.error(`❌ Failed to update user ${userId} with avatar:`, error);
    throw error;
  }
}
