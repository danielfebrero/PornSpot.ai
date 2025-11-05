import { SQSEvent, SQSRecord } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { SQSService } from "@shared/services/sqs";
import { ParameterStoreService } from "@shared/utils/parameters";
import { S3StorageService } from "@shared/services/s3-storage";
import { PromptProcessingService } from "@shared/services/prompt-processing";
import { loras as I2VLoraMap } from "@shared/utils/i2v-loras-selection";
import { randomBytes } from "crypto";

const RUNPOD_MODEL = "wan-2-2-i2v-720";
const RUNPOD_MODEL_LORA = "wan-2-2-t2v-720-lora";

interface ProcessRunpodMessage {
  jobId: string;
  userId: string;
  mediaId: string;
  mode: "image-to-video" | "video-extension";
  rawRequest: {
    prompt: string;
    negativePrompt: string;
    videoLength: number;
    seed?: number;
    flowShift: number;
    inferenceSteps: number;
    cfgScale: number;
    optimizePrompt: boolean;
    enableLoras: boolean;
  };
  mediaUrl?: string;
  mediaType?: string;
  mediaMetadata?: any;
  mediaWidth?: number;
  mediaHeight?: number;
  mediaThumbnailUrl?: string;
  mediaThumbnailUrls?: any;
  estimatedSeconds: number;
}

export const handler = async (event: SQSEvent): Promise<void> => {
  console.log("Processing RunPod submissions:", JSON.stringify(event));

  for (const record of event.Records) {
    await processRecord(record);
  }
};

async function processRecord(record: SQSRecord): Promise<void> {
  try {
    const message: ProcessRunpodMessage = JSON.parse(record.body);
    const { jobId, mode, rawRequest, estimatedSeconds } = message;

    // Get job to verify it exists and is in SUBMITTING status
    const job = await DynamoDBService.getI2VJob(jobId);
    if (!job) {
      console.error(`Job ${jobId} not found`);
      return;
    }

    if (job.status !== "SUBMITTING") {
      console.warn(`Job ${jobId} not in SUBMITTING status: ${job.status}`);
      return;
    }

    const cdnBaseUrl = "https://cdn.pornspot.ai";
    const toAbsoluteUrl = (value?: string | null): string | null => {
      if (!value) return null;
      if (value.startsWith("http")) return value;
      return value.startsWith("/")
        ? `${cdnBaseUrl}${value}`
        : `${cdnBaseUrl}/${value}`;
    };

    // 1. FRAME EXTRACTION (if video-extension mode)
    let runpodSourceImageUrl: string | undefined;
    let baseFrameKey: string | undefined;
    let baseFrameUrl: string | undefined;
    let sourceVideoUrl: string | undefined;

    const isVideoSource = mode === "video-extension";

    if (isVideoSource) {
      const resolvedVideoUrl = toAbsoluteUrl(message.mediaUrl);
      if (!resolvedVideoUrl) {
        throw new Error("Unable to locate source video for extension");
      }
      sourceVideoUrl = resolvedVideoUrl;

      try {
        const frameKeySuffix = `${jobId.substring(0, 8)}-${randomBytes(
          4
        ).toString("hex")}`;
        const s3 = S3StorageService.getInstance();
        const frameResult = await s3.extractVideoLastFrame({
          videoUrl: sourceVideoUrl,
          keyHint: `${message.mediaId}-${frameKeySuffix}`,
        });
        runpodSourceImageUrl = `${cdnBaseUrl}/${frameResult.key}`;
        baseFrameKey = frameResult.key;
        baseFrameUrl = frameResult.publicUrl;
      } catch (error) {
        console.error("Failed to extract last frame for video extension", {
          mediaId: message.mediaId,
          error,
        });
        // Fallback to thumbnail
        const fallbackFrame =
          toAbsoluteUrl(message.mediaThumbnailUrl) ??
          toAbsoluteUrl(message.mediaThumbnailUrls?.medium) ??
          toAbsoluteUrl(message.mediaThumbnailUrls?.large);
        if (!fallbackFrame) {
          throw new Error("Unable to prepare base frame for video");
        }
        runpodSourceImageUrl = fallbackFrame;
      }
    } else {
      const resolvedImageUrl = toAbsoluteUrl(message.mediaUrl);
      if (!resolvedImageUrl) {
        throw new Error("Unable to locate source image");
      }
      runpodSourceImageUrl = resolvedImageUrl;
    }

    if (!runpodSourceImageUrl) {
      throw new Error("Source media missing accessible URL");
    }
    if (!baseFrameUrl) {
      baseFrameUrl = runpodSourceImageUrl;
    }

    // 2. PROMPT PROCESSING
    const finalPrompt =
      rawRequest.prompt.trim() === ""
        ? (message.mediaMetadata?.["prompt"] as string) ?? ""
        : rawRequest.prompt;
    const trimmedFinalPrompt = (finalPrompt || "").trim();
    const promptBase = trimmedFinalPrompt || finalPrompt || "";

    const sourceImageUrl = runpodSourceImageUrl;

    // 3. PROMPT MODERATION
    const moderation = await PromptProcessingService.moderatePrompt(
      trimmedFinalPrompt
    );

    if (!moderation.success) {
      // Mark job as failed due to moderation
      await DynamoDBService.updateI2VJob(jobId, {
        status: "FAILED",
        submissionError: moderation.reason || "Content violates platform rules",
      });

      // Refund credits
      await refundCredits(job, rawRequest.videoLength);
      return;
    }

    // 4. PROMPT OPTIMIZATION (if requested)
    let promptForRunpod = promptBase;
    if (rawRequest.optimizePrompt) {
      const optimizationResult =
        await PromptProcessingService.optimizeI2VPrompt({
          prompt: promptBase,
          imageUrl: sourceImageUrl,
        });

      if (optimizationResult && optimizationResult.success) {
        promptForRunpod = optimizationResult.prompt;
        console.log("✅ I2V prompt optimized successfully");
      } else {
        console.warn(
          "⚠️ Prompt optimization failed, falling back to original prompt:",
          optimizationResult?.error
        );
      }
    }

    // 5. LORA SELECTION (if enabled)
    const enableLoras = rawRequest.enableLoras;
    let resolvedLoras: Array<{
      name: string;
      config: (typeof I2VLoraMap)[keyof typeof I2VLoraMap];
    }> = [];
    let triggerWords: string[] = [];

    if (enableLoras) {
      const loraSelection = await PromptProcessingService.selectI2VLoras(
        trimmedFinalPrompt
      );

      const uniqueSelectedLoras = Array.from(
        new Set((loraSelection?.loras || []).filter(Boolean))
      ).map((name) => name.toUpperCase());

      resolvedLoras = uniqueSelectedLoras.flatMap((name) => {
        const config = I2VLoraMap[name as keyof typeof I2VLoraMap];
        if (!config || !config.lora_high_path || !config.lora_low_path) {
          console.warn("Unknown or incomplete LoRA config", name);
          return [];
        }
        return [{ name, config }];
      });

      triggerWords = Array.from(
        new Set(
          (loraSelection?.triggerWords || [])
            .map((word) => word.trim())
            .filter(Boolean)
        )
      );
    }

    const runpodHighNoiseLoras = resolvedLoras.map(({ config }) => ({
      path: config.lora_high_path,
      scale: config.scale ?? 1,
    }));
    const runpodLowNoiseLoras = resolvedLoras.map(({ config }) => ({
      path: config.lora_low_path,
      scale: config.scale ?? 1,
    }));

    const storedHighNoiseLoras = resolvedLoras.map(({ name, config }) => ({
      id: name,
      mode: "auto" as const,
      scale: config.scale ?? 1,
    }));
    const storedLowNoiseLoras = resolvedLoras.map(({ name, config }) => ({
      id: name,
      mode: "auto" as const,
      scale: config.scale ?? 1,
    }));

    const hasValidLoras =
      enableLoras &&
      runpodHighNoiseLoras.length > 0 &&
      runpodLowNoiseLoras.length > 0 &&
      runpodHighNoiseLoras.length === runpodLowNoiseLoras.length;

    const promptWithTriggers = hasValidLoras
      ? `\n${triggerWords.join(" ")} ${promptForRunpod}`.trim()
      : promptForRunpod;

    // 6. GENERATE SEED
    const MAX_SEED = Number.MAX_SAFE_INTEGER;
    const generateRandomSeed = (): number => {
      let seed = 0;
      while (seed <= 0) {
        const buffer = randomBytes(8);
        let randomValue = 0n;
        for (const byte of buffer) {
          randomValue = (randomValue << 8n) | BigInt(byte);
        }
        randomValue >>= 11n; // keep within 53 bits to remain Number-safe
        seed = Math.min(MAX_SEED, Number(randomValue));
      }
      return seed > 0 ? seed : 1;
    };

    const resolveSeed = (rawSeed: unknown): number => {
      const numericSeed = Number(rawSeed);
      if (!Number.isFinite(numericSeed)) {
        return generateRandomSeed();
      }
      const floored = Math.floor(numericSeed);
      if (floored <= 0) {
        return generateRandomSeed();
      }
      return Math.min(floored, MAX_SEED);
    };

    const seedNumber = resolveSeed(rawRequest.seed);

    // 7. CALCULATE OUTPUT DIMENSIONS
    const srcWidth =
      (message.mediaMetadata as any)?.width ?? message.mediaWidth ?? 1024;
    const srcHeight =
      (message.mediaMetadata as any)?.height ?? message.mediaHeight ?? 1536;

    const MAX_DIM = 1792;
    const widthNum = Math.max(1, Math.floor(Number(srcWidth)));
    const heightNum = Math.max(1, Math.floor(Number(srcHeight)));
    const scale = Math.min(MAX_DIM / widthNum, MAX_DIM / heightNum, 1);
    const outWidth = Math.max(1, Math.floor(widthNum * scale));
    const outHeight = Math.max(1, Math.floor(heightNum * scale));

    // 8. BUILD RUNPOD INPUT
    const baseRunInput = {
      prompt: promptWithTriggers,
      image: sourceImageUrl,
      num_inference_steps: rawRequest.inferenceSteps,
      guidance: rawRequest.cfgScale,
      negative_prompt: rawRequest.negativePrompt || "",
      size: `${outWidth}*${outHeight}`,
      duration: rawRequest.videoLength,
      flow_shift: rawRequest.flowShift,
      seed: seedNumber,
      enable_prompt_optimization: !rawRequest.optimizePrompt,
      enable_safety_checker: false,
    };

    const runInput = hasValidLoras
      ? {
          ...baseRunInput,
          high_noise_loras: runpodHighNoiseLoras,
          low_noise_loras: runpodLowNoiseLoras,
        }
      : baseRunInput;

    // 9. UPDATE JOB WITH PROCESSING DETAILS
    await DynamoDBService.updateI2VJob(jobId, {
      sourceVideoUrl,
      baseFrameKey,
      baseFrameUrl,
      sourceImageUrl,
      runpodModel: hasValidLoras ? RUNPOD_MODEL_LORA : RUNPOD_MODEL,
      request: {
        ...job.request,
        prompt: promptWithTriggers,
        negativePrompt: rawRequest.negativePrompt,
        seed: String(seedNumber),
        width: outWidth,
        height: outHeight,
        selectedLoras: hasValidLoras
          ? resolvedLoras.map(({ name }) => name)
          : undefined,
        loraTriggerWords: triggerWords.length > 0 ? triggerWords : undefined,
        loraHighNoise: hasValidLoras ? storedHighNoiseLoras : undefined,
        loraLowNoise: hasValidLoras ? storedLowNoiseLoras : undefined,
      },
    });

    // 10. SUBMIT TO RUNPOD
    const runpodApiKey = await ParameterStoreService.getRunpodApiKey();
    const model = hasValidLoras ? RUNPOD_MODEL_LORA : RUNPOD_MODEL;
    const runpodUrl = `https://api.runpod.ai/v2/${model}/run`;

    const response = await fetch(runpodUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${runpodApiKey}`,
      },
      body: JSON.stringify({ input: runInput }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`RunPod submission failed for ${jobId}:`, error);

      // Increment attempt counter
      const attempts = await DynamoDBService.incrementSubmissionAttempts(
        jobId,
        `RunPod API error: ${response.status} ${error}`
      );

      // If max attempts reached (3), mark as FAILED and refund
      if (attempts >= 3) {
        await handleSubmissionFailure(job, error);
      }
      // Otherwise, message will be retried by SQS
      throw new Error(`RunPod submission failed: ${error}`);
    }

    const runpodResult = (await response.json()) as {
      id: string;
      status: string;
    };
    const runpodJobId = runpodResult.id;

    console.log(`RunPod job created: ${runpodJobId} for job ${jobId}`);

    // 11. UPDATE JOB WITH RUNPOD ID
    await DynamoDBService.updateI2VJobWithRunpodId(
      jobId,
      runpodJobId,
      "IN_QUEUE"
    );

    // 12. SEND TO POLL QUEUE
    const pollQueueUrl = process.env["I2V_POLL_QUEUE_URL"];
    if (pollQueueUrl) {
      await SQSService.sendMessage(
        pollQueueUrl,
        {
          jobId,
          runpodJobId,
          userId: message.userId,
          mediaId: message.mediaId,
          delayIdx: 0,
        },
        Math.min(estimatedSeconds, 900) // Max 15 min delay
      );
    }
  } catch (error) {
    console.error("Error processing RunPod submission:", error);
    throw error; // Let SQS handle retry
  }
}

async function handleSubmissionFailure(job: any, error: string): Promise<void> {
  // Update job status to FAILED
  await DynamoDBService.updateI2VJob(job.jobId, {
    status: "FAILED",
    submissionError: error,
  });

  // Refund credits
  const videoLength = job.request?.videoLength || job.request?.length || 5;
  await refundCredits(job, videoLength);
}

async function refundCredits(job: any, videoLength: number): Promise<void> {
  const user = await DynamoDBService.getUserById(job.userId);
  if (user) {
    const refundSeconds = videoLength;
    const currentPurchased = user.i2vCreditsSecondsPurchased || 0;

    await DynamoDBService.updateUser(job.userId, {
      i2vCreditsSecondsPurchased: currentPurchased + refundSeconds,
    });

    console.log(`Refunded ${refundSeconds}s credits to user ${job.userId}`);
  }
}
