import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

export interface UploadImageResult {
  key: string;
  url: string;
  publicUrl: string;
}

export class S3StorageService {
  private static instance: S3StorageService;
  private s3Client: S3Client;
  private bucketName: string;
  private cloudFrontDomain?: string;

  private constructor() {
    this.s3Client = new S3Client({
      region: process.env["AWS_REGION"] || "us-east-1",
    });
    this.bucketName = process.env["S3_BUCKET"] || "pornspot-media-bucket";
    this.cloudFrontDomain = process.env["CLOUDFRONT_DOMAIN_NAME"];
  }

  public static getInstance(): S3StorageService {
    if (!S3StorageService.instance) {
      S3StorageService.instance = new S3StorageService();
    }
    return S3StorageService.instance;
  }

  /**
   * Upload an image buffer to S3
   */
  async uploadGeneratedImage(
    imageBuffer: Buffer,
    generationId: string,
    imageIndex: number,
    mimeType: string = "image/jpeg"
  ): Promise<UploadImageResult> {
    const fileExtension = mimeType === "image/png" ? "png" : "jpg";
    const imageId = uuidv4();
    const key = `generated/${generationId}/${imageId}_${imageIndex}.${fileExtension}`;

    try {
      const putCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: imageBuffer,
        ContentType: mimeType,
        CacheControl: "public, max-age=31536000", // 1 year cache
        Metadata: {
          generationId,
          imageIndex: imageIndex.toString(),
          uploadedAt: new Date().toISOString(),
        },
      });

      await this.s3Client.send(putCommand);

      // Generate URLs
      const s3Url = `https://${this.bucketName}.s3.amazonaws.com/${key}`;
      const publicUrl = this.cloudFrontDomain
        ? `https://${this.cloudFrontDomain}/${key}`
        : s3Url;

      console.log(`✅ Image uploaded to S3: ${key}`);

      return {
        key,
        url: s3Url,
        publicUrl,
      };
    } catch (error) {
      console.error(`❌ Failed to upload image to S3:`, error);
      throw new Error(
        `S3 upload failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Upload an image buffer to S3 with a custom filename
   * Used for generated images where we want predictable filenames
   */
  async uploadGeneratedImageWithCustomFilename(
    imageBuffer: Buffer,
    generationId: string,
    customFilename: string,
    mimeType: string = "image/jpeg"
  ): Promise<UploadImageResult> {
    const key = `generated/${generationId}/${customFilename}`;

    try {
      const putCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: imageBuffer,
        ContentType: mimeType,
        CacheControl: "public, max-age=31536000", // 1 year cache
        Metadata: {
          generationId,
          customFilename,
          uploadedAt: new Date().toISOString(),
        },
      });

      await this.s3Client.send(putCommand);

      // Generate URLs
      const s3Url = `https://${this.bucketName}.s3.amazonaws.com/${key}`;
      const publicUrl = this.cloudFrontDomain
        ? `https://${this.cloudFrontDomain}/${key}`
        : s3Url;

      console.log(`✅ Image uploaded to S3 with custom filename: ${key}`);

      return {
        key,
        url: s3Url,
        publicUrl,
      };
    } catch (error) {
      console.error(`❌ Failed to upload image to S3:`, error);
      throw new Error(
        `S3 upload failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Upload multiple images concurrently
   */
  async uploadGeneratedImages(
    imageBuffers: Buffer[],
    generationId: string,
    mimeType: string = "image/jpeg"
  ): Promise<UploadImageResult[]> {
    const uploadPromises = imageBuffers.map((buffer, index) =>
      this.uploadGeneratedImage(buffer, generationId, index, mimeType)
    );

    try {
      const results = await Promise.all(uploadPromises);
      console.log(
        `✅ Uploaded ${results.length} images to S3 for generation ${generationId}`
      );
      return results;
    } catch (error) {
      console.error(
        `❌ Failed to upload images for generation ${generationId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Delete an image from S3
   */
  async deleteImage(key: string): Promise<void> {
    try {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(deleteCommand);
      console.log(`✅ Deleted image from S3: ${key}`);
    } catch (error) {
      console.error(`❌ Failed to delete image from S3: ${key}`, error);
      throw new Error(
        `S3 delete failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Delete multiple images concurrently
   */
  async deleteImages(keys: string[]): Promise<void> {
    const deletePromises = keys.map((key) => this.deleteImage(key));

    try {
      await Promise.all(deletePromises);
      console.log(`✅ Deleted ${keys.length} images from S3`);
    } catch (error) {
      console.error(`❌ Failed to delete images from S3:`, error);
      throw error;
    }
  }

  /**
   * Generate a public URL for an S3 object
   */
  getPublicUrl(key: string): string {
    if (this.cloudFrontDomain) {
      return `https://${this.cloudFrontDomain}/${key}`;
    }
    return `https://${this.bucketName}.s3.amazonaws.com/${key}`;
  }

  /**
   * Extract S3 key from a URL
   */
  extractKeyFromUrl(url: string): string | null {
    try {
      // Handle CloudFront URLs
      if (this.cloudFrontDomain && url.includes(this.cloudFrontDomain)) {
        const urlObj = new URL(url);
        return urlObj.pathname.substring(1); // Remove leading slash
      }

      // Handle S3 URLs
      if (url.includes(".s3.amazonaws.com/")) {
        const urlObj = new URL(url);
        return urlObj.pathname.substring(1); // Remove leading slash
      }

      return null;
    } catch (error) {
      console.error("Failed to extract S3 key from URL:", error);
      return null;
    }
  }

  /**
   * Validate if a URL is from our S3 bucket
   */
  isOurS3Url(url: string): boolean {
    return (
      url.includes(this.bucketName) ||
      (this.cloudFrontDomain !== undefined &&
        url.includes(this.cloudFrontDomain))
    );
  }
}
