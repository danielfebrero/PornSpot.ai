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
// Use require for ffprobe-static to avoid type dependency; optional at runtime
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffprobePath: string | null = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const p = require("ffprobe-static");
    return p?.path || null;
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

  private sanitizeKeySegment(input: string): string {
    return input.replace(/[^a-zA-Z0-9-_]/g, "-");
  }

  private async downloadUrlToTmp(
    url: string,
    destPath: string
  ): Promise<Buffer> {
    const res = await fetch(url);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Download failed ${res.status}: ${txt}`);
    }
    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    await fs.writeFile(destPath, buffer);
    return buffer;
  }

  private async runFfmpeg(args: string[]): Promise<void> {
    if (!ffmpegPath) {
      throw new Error("ffmpeg-static not available");
    }

    await new Promise<void>((resolve, reject) => {
      const cp = spawn(ffmpegPath as string, args);
      let stderr = "";
      cp.stderr.on("data", (d) => (stderr += d.toString()));
      cp.on("error", reject);
      cp.on("close", (code, signal) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(
          new Error(
            `ffmpeg exited with code ${
              code ?? "null"
            } signal ${signal}: ${stderr}`
          )
        );
      });
    });
  }

  private shouldDisableWebmConversion(): boolean {
    const lambdaMemMb = Number(
      process.env["AWS_LAMBDA_FUNCTION_MEMORY_SIZE"] || "0"
    );
    const disableWebmEnv = (
      process.env["I2V_DISABLE_WEBM"] || ""
    ).toLowerCase();
    return (
      disableWebmEnv === "1" ||
      disableWebmEnv === "true" ||
      (lambdaMemMb > 0 && lambdaMemMb < 1024)
    );
  }

  private async uploadI2VVideoFromTmp(
    jobId: string,
    tmpMp4: string,
    options?: { contentType?: string; existingMp4Buffer?: Buffer }
  ): Promise<UploadVideoPairResult> {
    const contentType = options?.contentType ?? "video/mp4";
    const mp4Key = `generated/i2v/${jobId}.mp4`;
    const webmKey = `generated/i2v/${jobId}.webm`;
    const tmpWebm = pathJoin(tmpdir(), `${jobId}.webm`);
    let mp4Buffer = options?.existingMp4Buffer;
    let mp4Size: number | undefined;
    let webmBuffer: Buffer | undefined;

    try {
      if (!mp4Buffer) {
        mp4Buffer = await fs.readFile(tmpMp4);
      }
      mp4Size = mp4Buffer.byteLength;

      const disableWebm = this.shouldDisableWebmConversion();

      if (ffmpegPath && !disableWebm) {
        try {
          const crf = process.env["I2V_WEBM_CRF"] || "36";
          const threads = process.env["I2V_WEBM_THREADS"] || "2";

          await this.runFfmpeg([
            "-hide_banner",
            "-loglevel",
            "warning",
            "-y",
            "-i",
            tmpMp4,
            "-c:v",
            "libvpx-vp9",
            "-b:v",
            "0",
            "-crf",
            crf,
            "-row-mt",
            "1",
            "-deadline",
            "realtime",
            "-cpu-used",
            "8",
            "-pix_fmt",
            "yuv420p",
            "-threads",
            threads,
            "-an",
            tmpWebm,
          ]);
          webmBuffer = await fs.readFile(tmpWebm);
        } catch (err) {
          console.warn("WebM conversion failed; proceeding with MP4 only", err);
        }
      } else if (!ffmpegPath) {
        console.warn("ffmpeg-static not available; skipping WebM conversion");
      } else {
        console.warn(
          `Skipping WebM conversion (disabled=${disableWebm} env=${process.env["I2V_DISABLE_WEBM"]})`
        );
      }

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: mp4Key,
          Body: mp4Buffer,
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
    } finally {
      await fs.unlink(tmpWebm).catch(() => undefined);
    }
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
    const tmpMp4 = pathJoin(tmpdir(), `${jobId}.mp4`);
    let mp4Buffer: Buffer | undefined;
    try {
      mp4Buffer = await this.downloadUrlToTmp(fileUrl, tmpMp4);
      return await this.uploadI2VVideoFromTmp(jobId, tmpMp4, {
        contentType,
        existingMp4Buffer: mp4Buffer,
      });
    } catch (error) {
      console.error("❌ Failed to save I2V result to S3:", error);
      throw error;
    } finally {
      await fs.unlink(tmpMp4).catch(() => undefined);
    }
  }

  async getVideoNbFrames(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn(ffprobePath || "ffprobe", [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=nb_frames",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        videoPath,
      ]);

      let output = "";
      ffprobe.stdout.on("data", (data) => {
        output += data.toString();
      });

      ffprobe.on("close", (code) => {
        if (code !== 0) {
          reject(new Error("Failed to get video frame count"));
          return;
        }

        const nbFrames = Number(output.trim());

        // Default to 0 if unable to detect (though unlikely)
        resolve(nbFrames || 0);
      });

      ffprobe.on("error", reject);
    });
  }

  async extractVideoLastFrame(params: {
    videoUrl: string;
    keyHint?: string;
    format?: "jpg" | "png";
  }): Promise<UploadImageResult> {
    if (!ffmpegPath) {
      throw new Error("ffmpeg-static not available; cannot extract frames");
    }

    const format = params.format ?? "jpg";
    const safeHint = params.keyHint
      ? this.sanitizeKeySegment(params.keyHint)
      : uuidv4();
    const key = `generated/i2v/base-frames/${safeHint}.${format}`;
    const tmpVideo = pathJoin(tmpdir(), `${safeHint}-src.mp4`);
    const tmpFrame = pathJoin(tmpdir(), `${safeHint}-frame.${format}`);

    try {
      await this.downloadUrlToTmp(params.videoUrl, tmpVideo);

      // Probe the exact number of frames
      const nbFrames = await this.getVideoNbFrames(tmpVideo);
      if (nbFrames <= 0) {
        throw new Error("Unable to determine video frame count");
      }

      await this.runFfmpeg([
        "-hide_banner",
        "-loglevel",
        "warning",
        "-y",
        "-i",
        tmpVideo,
        "-vf",
        `select=eq(n\\,${nbFrames - 1})`,
        "-frames:v",
        "1",
        "-q:v",
        format === "png" ? "1" : "2",
        tmpFrame,
      ]);

      const frameBuffer = await fs.readFile(tmpFrame);

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: frameBuffer,
          ContentType: format === "png" ? "image/png" : "image/jpeg",
          CacheControl: "public, max-age=31536000",
          Metadata: {
            uploadedAt: new Date().toISOString(),
            source: "video-last-frame",
          },
        })
      );

      const s3Url = `https://${this.bucketName}.s3.amazonaws.com/${key}`;
      const publicUrl = this.cloudFrontDomain
        ? `https://${this.cloudFrontDomain}/${key}`
        : s3Url;

      console.log(`✅ Extracted last frame and uploaded to S3: ${key}`);

      return {
        key,
        url: s3Url,
        publicUrl,
        size: frameBuffer.byteLength,
      };
    } finally {
      await fs.unlink(tmpVideo).catch(() => undefined);
      await fs.unlink(tmpFrame).catch(() => undefined);
    }
  }

  async saveI2VConcatenatedVideo(
    jobId: string,
    baseVideoUrl: string,
    appendedVideoUrl: string
  ): Promise<UploadVideoPairResult> {
    if (!ffmpegPath) {
      throw new Error("ffmpeg-static not available; cannot concatenate videos");
    }

    const tmpBase = pathJoin(tmpdir(), `${jobId}-base.mp4`);
    const tmpAppended = pathJoin(tmpdir(), `${jobId}-append.mp4`);
    const tmpConcat = pathJoin(tmpdir(), `${jobId}-concat.mp4`);

    try {
      await this.downloadUrlToTmp(baseVideoUrl, tmpBase);
      await this.downloadUrlToTmp(appendedVideoUrl, tmpAppended);

      // Get the frame rate of the base video to ensure consistent timing
      const frameRate = await this.getVideoFrameRate(tmpBase);

      // Probe frame counts for precise trimming (to handle +1 frame extras without forcing fixed durations)
      const baseNbFrames = await this.getVideoNbFrames(tmpBase);
      const appendedNbFrames = await this.getVideoNbFrames(tmpAppended);
      if (baseNbFrames <= 0 || appendedNbFrames <= 0) {
        throw new Error("Unable to determine video frame counts");
      }

      // Calculate end frame for total trim: full base + (appended -1 for duplicate skip) -1 for overall extra frame
      const totalEndFrame = baseNbFrames + appendedNbFrames - 2;

      // Concatenate videos with proper frame handling
      await this.runFfmpeg([
        "-hide_banner",
        "-loglevel",
        "warning",
        "-y",
        "-i",
        tmpBase,
        "-i",
        tmpAppended,
        "-filter_complex",
        // Process first video: normalize format and timestamps
        `[0:v]fps=${frameRate},format=yuv420p,setpts=PTS-STARTPTS[v0];` +
          // Process second video: skip first frame (duplicate of last frame from first video)
          // and adjust timestamps to continue from where first video ends
          `[1:v]fps=${frameRate},format=yuv420p,trim=start_frame=1,setpts=PTS-STARTPTS[v1];` +
          // Concatenate the two processed videos
          `[v0][v1]concat=n=2:v=1:a=0[outv];` +
          // Trim total to drop the extra frame at end for exact intended length
          `[outv]trim=end_frame=${totalEndFrame},setpts=PTS-STARTPTS[finalv]`,
        "-map",
        "[finalv]",
        // Use high-quality encoding settings
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        // Ensure proper keyframe intervals for smooth playback
        "-g",
        String(Math.floor(frameRate * 2)), // keyframe every 2 seconds
        "-movflags",
        "+faststart",
        // Explicitly set output frame rate
        "-r",
        String(frameRate),
        tmpConcat,
      ]);

      return await this.uploadI2VVideoFromTmp(jobId, tmpConcat);
    } finally {
      await fs.unlink(tmpBase).catch(() => undefined);
      await fs.unlink(tmpAppended).catch(() => undefined);
      await fs.unlink(tmpConcat).catch(() => undefined);
    }
  }

  // Helper function to get video frame rate
  async getVideoFrameRate(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn(ffprobePath || "ffprobe", [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=r_frame_rate",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        videoPath,
      ]);

      let output = "";
      ffprobe.stdout.on("data", (data) => {
        output += data.toString();
      });

      ffprobe.on("close", (code) => {
        if (code !== 0) {
          reject(new Error("Failed to get video frame rate"));
          return;
        }

        // Parse frame rate (e.g., "30/1" or "25/1")
        const parts = output.trim().split("/");
        const num = Number(parts[0]);
        const den = Number(parts[1] || 1);
        const frameRate = num / den;

        // Default to 30 fps if unable to detect
        resolve(frameRate || 30);
      });

      ffprobe.on("error", reject);
    });
  }
}
