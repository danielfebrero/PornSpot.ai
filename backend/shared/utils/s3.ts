/**
 * @fileoverview S3 Service Utility
 * @description Centralized S3 operations for uploads, downloads, presigned URLs, and deletions.
 * @notes
 * - Supports LocalStack in development with path style.
 * - Generates presigned URLs for upload/download with metadata.
 * - Handles avatar/media uploads with context-specific keys.
 * - Bulk delete with batching (1000 max per request).
 * - Public URL generation via CloudFront or direct S3.
 * - Relative path utilities.
 * - Disables checksums for LocalStack compatibility.
 */
import {
  S3Client,
  S3ClientConfig,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import * as path from "path";
import { HttpRequest } from "@aws-sdk/types";

const isLocal = process.env["AWS_SAM_LOCAL"] === "true";

let s3Config: S3ClientConfig = {};

if (isLocal) {
  s3Config = {
    endpoint: "http://pornspot-local-aws:4566",
    region: process.env["AWS_REGION"] || "us-east-1",
    credentials: {
      accessKeyId: "test",
      secretAccessKey: "test",
    },
    forcePathStyle: true, // Required for LocalStack
    // Disable checksums for LocalStack compatibility
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  };
} else {
  s3Config = {
    region: process.env["AWS_REGION"] || "us-east-1",
  };
}

const s3Client = new S3Client(s3Config);

const BUCKET_NAME = (
  isLocal ? "local-pornspot-media" : process.env["S3_BUCKET"]
)!;

const CLOUDFRONT_DOMAIN = process.env["CLOUDFRONT_DOMAIN"]!;

export class S3Service {
  static async generatePresignedUploadUrl(
    context: string, // Either "media" or "avatar"
    identifier: string, // albumId for media, userId for avatar
    filename: string,
    mimeType: string,
    expiresIn: number = 3600
  ): Promise<{ uploadUrl: string; key: string }> {
    const fileExtension = path.extname(filename);
    let key: string;
    let metadata: Record<string, string>;

    if (context === "avatar") {
      // Avatar uploads: users/{userId}/avatar/{uuid}.ext
      key = `users/${identifier}/avatar/${uuidv4()}${fileExtension}`;
      metadata = {
        "original-filename": filename,
        "user-id": identifier,
        "upload-type": "avatar",
      };
    } else {
      // Default to media uploads: albums/{albumId}/media/{uuid}.ext
      key = `albums/${identifier}/media/${uuidv4()}${fileExtension}`;
      metadata = {
        "original-filename": filename,
        "album-id": identifier,
        "upload-type": "media",
      };
    }

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: mimeType,
      Metadata: metadata,
      // Explicitly disable checksums for LocalStack compatibility
      ...(isLocal && { ChecksumAlgorithm: undefined }),
    });

    // Enhanced middleware to remove checksum-related headers and parameters
    // that cause issues with LocalStack and browser uploads
    command.middlewareStack.add(
      (next) => async (args) => {
        const request = args.request as HttpRequest;

        // Remove checksum-related headers
        delete request.headers["x-amz-sdk-checksum-algorithm"];
        delete request.headers["x-amz-checksum-crc32"];
        delete request.headers["x-amz-content-sha256"];

        // Remove checksum from query parameters if present
        if (request.query) {
          delete request.query["x-amz-sdk-checksum-algorithm"];
          delete request.query["x-amz-checksum-crc32"];
        }

        return next(args);
      },
      {
        step: "build",
        name: "removeChecksumHeaders",
        priority: "high",
      }
    );

    interface SignedUrlOptions {
      expiresIn: number;
      signableHeaders: Set<string>;
      unsignableHeaders?: Set<string>;
    }

    const signedUrlOptions: SignedUrlOptions = {
      expiresIn,
      signableHeaders: new Set([
        "host",
        "content-type",
        "x-amz-meta-original-filename",
        "x-amz-meta-album-id",
        "x-amz-meta-user-id",
        "x-amz-meta-upload-type",
      ]),
    };

    // For LocalStack, disable checksum validation entirely
    if (isLocal) {
      signedUrlOptions.unsignableHeaders = new Set([
        "x-amz-sdk-checksum-algorithm",
        "x-amz-checksum-crc32",
        "x-amz-content-sha256",
      ]);
    }

    const rawUrl = await getSignedUrl(s3Client, command, signedUrlOptions);

    const uploadUrl = isLocal
      ? rawUrl.replace("pornspot-local-aws", "localhost")
      : rawUrl;

    return { uploadUrl, key };
  }

  // Backward compatibility method for media uploads
  static async generateMediaPresignedUploadUrl(
    albumId: string,
    filename: string,
    mimeType: string,
    expiresIn: number = 3600
  ): Promise<{ uploadUrl: string; key: string }> {
    return this.generatePresignedUploadUrl(
      "media",
      albumId,
      filename,
      mimeType,
      expiresIn
    );
  }

  // Specific method for avatar uploads
  static async generateAvatarPresignedUploadUrl(
    userId: string,
    filename: string,
    mimeType: string,
    expiresIn: number = 300 // 5 minutes for avatars
  ): Promise<{ uploadUrl: string; key: string }> {
    return this.generatePresignedUploadUrl(
      "avatar",
      userId,
      filename,
      mimeType,
      expiresIn
    );
  }

  static async generatePresignedDownloadUrl(
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    return await getSignedUrl(s3Client, command, { expiresIn });
  }

  static async deleteObject(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
  }

  static async deleteObjects(keys: string[]): Promise<{
    successful: string[];
    failed: Array<{ key: string; error: string }>;
  }> {
    if (keys.length === 0) {
      return { successful: [], failed: [] };
    }

    const successful: string[] = [];
    const failed: Array<{ key: string; error: string }> = [];

    // AWS S3 DeleteObjects supports up to 1000 objects per request
    const BATCH_SIZE = 1000;

    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
      const batch = keys.slice(i, i + BATCH_SIZE);

      try {
        const command = new DeleteObjectsCommand({
          Bucket: BUCKET_NAME,
          Delete: {
            Objects: batch.map((key) => ({ Key: key })),
            Quiet: false, // Get back info about deleted objects
          },
        });

        const response = await s3Client.send(command);

        // Track successful deletions
        if (response.Deleted) {
          successful.push(...response.Deleted.map((obj) => obj.Key!));
        }

        // Track failed deletions
        if (response.Errors) {
          failed.push(
            ...response.Errors.map((err) => ({
              key: err.Key!,
              error: `${err.Code}: ${err.Message}`,
            }))
          );
        }
      } catch (error) {
        // If entire batch fails, mark all as failed
        failed.push(
          ...batch.map((key) => ({
            key,
            error: `Batch deletion failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          }))
        );
      }
    }

    return { successful, failed };
  }

  static getPublicUrl(key: string): string {
    if (isLocal) {
      return `http://localhost:4566/${BUCKET_NAME}/${key}`;
    }

    if (CLOUDFRONT_DOMAIN) {
      // Remove any existing protocol prefix to avoid duplication
      return `${CLOUDFRONT_DOMAIN}/${key}`;
    }

    const region = process.env["AWS_REGION"] || "us-east-1";
    return `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${key}`;
  }

  static getRelativePath(key: string): string {
    // Return the key as a relative path (with leading slash)
    return key.startsWith("/") ? key : `/${key}`;
  }

  static composePublicUrl(relativePath: string): string {
    // Remove leading slash if present for key composition
    const key = relativePath.startsWith("/")
      ? relativePath.substring(1)
      : relativePath;
    return this.getPublicUrl(key);
  }

  static getThumbnailKey(originalKey: string): string {
    const parsedPath = path.parse(originalKey);
    return `${parsedPath.dir}/thumbnails/${parsedPath.name}_thumb.webp`;
  }

  static async uploadBuffer(
    key: string,
    buffer: Buffer,
    mimeType: string,
    metadata?: Record<string, string>
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      Metadata: metadata,
    });

    await s3Client.send(command);
  }

  static extractKeyFromUrl(url: string): string | null {
    if (!url || typeof url !== "string") {
      return null;
    }

    // If it's already a relative path (starts with /), remove the leading slash and return
    if (url.startsWith("/")) {
      return url.substring(1);
    }

    try {
      const urlObj = new URL(url);

      if (isLocal) {
        const pathParts = urlObj.pathname.split("/");
        return pathParts.slice(2).join("/");
      }

      return urlObj.pathname.substring(1);
    } catch {
      return null;
    }
  }
  static async downloadBuffer(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      throw new Error(`Failed to download object: ${key}`);
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    const stream = response.Body as any;

    return new Promise((resolve, reject) => {
      stream.on("data", (chunk: Uint8Array) => chunks.push(chunk));
      stream.on("error", reject);
      stream.on("end", () => resolve(Buffer.concat(chunks)));
    });
  }
}
