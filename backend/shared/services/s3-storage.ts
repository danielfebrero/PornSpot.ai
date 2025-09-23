/**
 * @fileoverview S3 Storage Service
 * @description Service for uploading generated images to S3 with metadata and custom filenames.
 * @notes
 * - Uploads buffers to S3 with generation ID.
 * - Supports custom filenames for predictable URLs.
 * - Bulk upload for multiple images.
 * - Deletes images and multiple images.
 * - Generates public URLs via CloudFront or direct S3.
 * - Validates S3 URLs.
 * - Singleton pattern.
 */
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join as pathJoin } from "path";
import { spawn } from "child_process";
// Use require for ffmpeg-static to avoid type dependency; optional at runtime
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegPath: string | null = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const p = require("ffmpeg-static");
    return p || null;
  } catch (_err) {
    return null;
  }
})();
import { v4 as uuidv4 } from "uuid";

export interface UploadImageResult {
  key: string;
  url: string;
  publicUrl: string;
  size?: number; // bytes
}

export interface UploadVideoPairResult {
  mp4: UploadImageResult;
  webm?: UploadImageResult; // optional if conversion fails
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

  /**
   * Download a remote file (e.g., Runpod result) and upload it to S3 under a predictable I2V path
   * Returns S3 key and URLs.
   */
  async saveI2VResultFromUrl(
    jobId: string,
    fileUrl: string,
    contentType: string = "video/mp4"
  ): Promise<UploadVideoPairResult> {
    const mp4Key = `generated/i2v/${jobId}.mp4`;
    const webmKey = `generated/i2v/${jobId}.webm`;
    const tmpMp4 = pathJoin(tmpdir(), `${jobId}.mp4`);
    const tmpWebm = pathJoin(tmpdir(), `${jobId}.webm`);
    let mp4Size: number | undefined;
    let webmBuffer: Buffer | undefined;
    try {
      const res = await fetch(fileUrl);
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Download failed ${res.status}: ${txt}`);
      }
      const arrayBuf = await res.arrayBuffer();
      const mp4Buffer = Buffer.from(arrayBuf);
      mp4Size = mp4Buffer.byteLength;

      // Persist source MP4 to /tmp for conversion
      await fs.writeFile(tmpMp4, mp4Buffer);

      // Attempt MP4 -> WebM conversion using ffmpeg-static if available
      if (ffmpegPath) {
        await new Promise<void>((resolve, reject) => {
          const args = [
            "-y",
            "-i",
            tmpMp4,
            // VP9 settings: good quality at reasonable size; no audio to simplify
            "-c:v",
            "libvpx-vp9",
            "-b:v",
            "0",
            "-crf",
            "33",
            "-row-mt",
            "1",
            "-deadline",
            "good",
            "-cpu-used",
            "4",
            "-an",
            tmpWebm,
          ];
          const cp = spawn(ffmpegPath as string, args);
          let stderr = "";
          cp.stderr.on("data", (d) => (stderr += d.toString()));
          cp.on("error", reject);
          cp.on("close", (code) => {
            if (code === 0) return resolve();
            console.warn(`ffmpeg exited with code ${code}: ${stderr}`);
            reject(new Error(`ffmpeg code ${code}`));
          });
        })
          .then(async () => {
            webmBuffer = await fs.readFile(tmpWebm);
          })
          .catch((err) => {
            console.warn(
              "WebM conversion failed; proceeding with MP4 only",
              err
            );
          });
      } else {
        console.warn("ffmpeg-static not available; skipping WebM conversion");
      }

      // Upload MP4
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: mp4Key,
          Body: await fs.readFile(tmpMp4),
          ContentType: contentType,
          CacheControl: "public, max-age=31536000",
          Metadata: {
            uploadedAt: new Date().toISOString(),
            source: "runpod",
            jobId,
            format: "mp4",
          },
        })
      );

      // Upload WebM (if converted)
      let webmResult: UploadImageResult | undefined;
      if (webmBuffer) {
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.bucketName,
            Key: webmKey,
            Body: webmBuffer,
            ContentType: "video/webm",
            CacheControl: "public, max-age=31536000",
            Metadata: {
              uploadedAt: new Date().toISOString(),
              source: "runpod",
              jobId,
              format: "webm",
            },
          })
        );
        const webmS3Url = `https://${this.bucketName}.s3.amazonaws.com/${webmKey}`;
        const webmPublicUrl = this.cloudFrontDomain
          ? `https://${this.cloudFrontDomain}/${webmKey}`
          : webmS3Url;
        webmResult = {
          key: webmKey,
          url: webmS3Url,
          publicUrl: webmPublicUrl,
          size: webmBuffer.byteLength,
        };
        console.log(`✅ I2V WebM saved to S3: ${webmKey}`);
      }

      const mp4S3Url = `https://${this.bucketName}.s3.amazonaws.com/${mp4Key}`;
      const mp4PublicUrl = this.cloudFrontDomain
        ? `https://${this.cloudFrontDomain}/${mp4Key}`
        : mp4S3Url;

      console.log(`✅ I2V MP4 saved to S3: ${mp4Key}`);

      return {
        mp4: {
          key: mp4Key,
          url: mp4S3Url,
          publicUrl: mp4PublicUrl,
          size: mp4Size,
        },
        webm: webmResult,
      };
    } catch (error) {
      console.error("❌ Failed to save I2V result to S3:", error);
      throw error;
    } finally {
      // Cleanup tmp files (ignore errors)
      await fs.unlink(tmpMp4).catch(() => undefined);
      await fs.unlink(tmpWebm).catch(() => undefined);
    }
  }
}
