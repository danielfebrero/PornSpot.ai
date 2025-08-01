import { S3Event, S3EventRecord } from "aws-lambda";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ThumbnailService } from "@shared/utils/thumbnail";
import { RevalidationService } from "@shared/utils/revalidation";
import { S3Service } from "@shared/utils/s3";
import { Readable } from "stream";

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
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

  console.log(`Processing uploaded file: ${key}`);

  // Skip if this is already a thumbnail
  if (key.includes("/thumbnails/")) {
    console.log("Skipping thumbnail file");
    return;
  }

  // Extract album ID and media ID from the key
  const keyParts = key.split("/");
  if (
    keyParts.length < 4 ||
    keyParts[0] !== "albums" ||
    keyParts[2] !== "media"
  ) {
    console.log("Invalid key format, skipping:", key);
    return;
  }

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
        const updateData: Partial<import("@shared/types").MediaEntity> = {
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
        const updateData: Partial<import("@shared/types").MediaEntity> = {
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
