import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ValidationUtil } from "@shared/utils/validation";
import { ParameterStoreService } from "@shared/utils/parameters";
import {
  I2VJobEntity,
  I2VSubmitJobRequest,
  I2VSettings,
} from "@shared/shared-types";
import { SQS } from "aws-sdk";
import { PromptProcessingService } from "@shared/services/prompt-processing";
import { loras as I2VLoraMap } from "@shared/utils/i2v-loras-selection";
import { randomBytes } from "crypto";

const RUNPOD_MODEL = "wan-2-2-i2v-720";
const RUNPOD_MODEL_LORA = "wan-2-2-t2v-720-lora";

export const handleSubmitI2VJob = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  // Only allow POST method
  if (event.httpMethod !== "POST") {
    return ResponseUtil.methodNotAllowed(event, "Only POST method allowed");
  }

  if (!event.body) {
    return ResponseUtil.badRequest(
      event,
      ValidationUtil.MESSAGES.REQUIRED_BODY
    );
  }

  let body: I2VSubmitJobRequest;
  try {
    body = JSON.parse(event.body);
  } catch {
    return ResponseUtil.badRequest(event, ValidationUtil.MESSAGES.INVALID_JSON);
  }

  // Validate required fields
  const mediaId = ValidationUtil.validateRequiredString(
    body.mediaId,
    "mediaId"
  );
  const prompt = body.prompt ?? "";
  const negativePrompt = body.negativePrompt ?? "";
  const videoLength = body.videoLength as I2VSettings["videoLength"];
  const flowShift = body.flowShift;
  const inferenceSteps = body.inferenceSteps;
  const cfgScale = body.cfgScale;
  const optimizePrompt = !!body.optimizePrompt;
  const isPublic = body.isPublic === undefined ? true : !!body.isPublic;
  const enableLoras =
    body.enableLoras === undefined ? true : !!body.enableLoras;

  // Basic numeric validations (keep lightweight and fail fast)
  if (![5, 8, 10, 15, 20, 25, 30].includes(videoLength)) {
    return ResponseUtil.badRequest(
      event,
      "videoLength must be one of 5, 8, 10, 15, 20, 25, 30"
    );
  }
  if (enableLoras && ![5, 8].includes(videoLength)) {
    return ResponseUtil.badRequest(
      event,
      "LoRA-enabled videos must use a length of 5 or 8 seconds"
    );
  }
  if (typeof flowShift !== "number" || flowShift < 1 || flowShift > 10) {
    return ResponseUtil.badRequest(event, "flowShift must be between 1 and 10");
  }
  if (
    typeof inferenceSteps !== "number" ||
    inferenceSteps < 20 ||
    inferenceSteps > 40
  ) {
    return ResponseUtil.badRequest(
      event,
      "inferenceSteps must be between 20 and 40"
    );
  }
  if (typeof cfgScale !== "number" || cfgScale < 1 || cfgScale > 10) {
    return ResponseUtil.badRequest(event, "cfgScale must be between 1 and 10");
  }

  // Get source media
  const media = await DynamoDBService.getMedia(mediaId);
  if (!media || !media.url) {
    return ResponseUtil.notFound(
      event,
      "Source media not found or missing URL"
    );
  }

  // Check user I2V credits
  const userEntity = await DynamoDBService.getUserById(auth.userId);
  if (!userEntity) {
    return ResponseUtil.unauthorized(event, "User not found");
  }

  const availableCredits =
    (userEntity.i2vCreditsSecondsPurchased ?? 0) +
    (userEntity.i2vCreditsSecondsFromPlan ?? 0);
  if (availableCredits < videoLength) {
    return ResponseUtil.forbidden(
      event,
      `Not enough I2V credits. Required: ${videoLength}s, Available: ${availableCredits}s`
    );
  }

  const finalPrompt =
    prompt.trim() === "" ? (media.metadata?.["prompt"] as string) : prompt;
  const trimmedFinalPrompt = (finalPrompt || "").trim();
  const promptBase = trimmedFinalPrompt || finalPrompt || "";

  // Build full CDN URL (prepend as required)
  const sourceImageUrl = media.url.startsWith("http")
    ? media.url
    : `https://cdn.pornspot.ai${media.url}`;

  const moderationPromise =
    PromptProcessingService.moderatePrompt(trimmedFinalPrompt);
  const optimizationPromise = optimizePrompt
    ? PromptProcessingService.optimizeI2VPrompt({
        prompt: promptBase,
        imageUrl: sourceImageUrl,
      })
    : Promise.resolve(null);
  const loraSelectionPromise = enableLoras
    ? PromptProcessingService.selectI2VLoras(trimmedFinalPrompt)
    : Promise.resolve({ loras: [], triggerWords: [] });

  const [moderation, optimizationResult, loraSelection] = await Promise.all([
    moderationPromise,
    optimizationPromise,
    loraSelectionPromise,
  ]);

  if (!moderation.success) {
    return ResponseUtil.badRequest(
      event,
      moderation.reason || "Content violates platform rules"
    );
  }

  // Fetch Runpod API key
  const runpodApiKey = await ParameterStoreService.getRunpodApiKey();

  let promptForRunpod = promptBase;
  if (optimizePrompt && optimizationResult) {
    if (optimizationResult.success) {
      promptForRunpod = optimizationResult.prompt;
      console.log("✅ I2V prompt optimized successfully");
    } else {
      console.warn(
        "⚠️ Prompt optimization failed, falling back to original prompt:",
        optimizationResult.error
      );
    }
  }

  const uniqueSelectedLoras = Array.from(
    new Set((loraSelection?.loras || []).filter(Boolean))
  ).map((name) => name.toUpperCase());
  const resolvedLoras = uniqueSelectedLoras.flatMap((name) => {
    const config = I2VLoraMap[name as keyof typeof I2VLoraMap];
    if (!config || !config.lora_high_path || !config.lora_low_path) {
      console.warn("Unknown or incomplete LoRA config", name);
      return [];
    }
    return [{ name, config }];
  });

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

  const triggerWords = hasValidLoras
    ? Array.from(
        new Set(
          (loraSelection?.triggerWords || [])
            .map((word) => word.trim())
            .filter(Boolean)
        )
      )
    : [];

  const promptWithTriggers = hasValidLoras
    ? `\n${triggerWords.join(" ")} ${promptForRunpod}`.trim()
    : promptForRunpod;

  // Prepare Runpod payload
  const MAX_SEED = Number.MAX_SAFE_INTEGER; // 9007199254740991
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

  const seedNumber = resolveSeed(body.seed);

  // Determine output size from source media metadata (fallback to top-level width/height, then defaults)
  const srcWidth = (media.metadata as any)?.width ?? media.width ?? 1024;
  const srcHeight = (media.metadata as any)?.height ?? media.height ?? 1536;

  // Cap dimensions to a maximum of 1792x1792 while preserving aspect ratio.
  // Never upscale: if both dimensions are already <= 1792, keep as-is.
  const MAX_DIM = 1792;
  const widthNum = Math.max(1, Math.floor(Number(srcWidth)));
  const heightNum = Math.max(1, Math.floor(Number(srcHeight)));
  const scale = Math.min(MAX_DIM / widthNum, MAX_DIM / heightNum, 1);
  const outWidth = Math.max(1, Math.floor(widthNum * scale));
  const outHeight = Math.max(1, Math.floor(heightNum * scale));

  const baseRunInput = {
    prompt: promptWithTriggers,
    image: sourceImageUrl,
    num_inference_steps: inferenceSteps,
    guidance: cfgScale,
    negative_prompt: negativePrompt || "",
    size: `${outWidth}*${outHeight}`,
    duration: videoLength,
    flow_shift: flowShift,
    seed: seedNumber,
    enable_prompt_optimization: !optimizePrompt,
    enable_safety_checker: false,
  };

  const runInput = hasValidLoras
    ? {
        ...baseRunInput,
        high_noise_loras: runpodHighNoiseLoras,
        low_noise_loras: runpodLowNoiseLoras,
      }
    : baseRunInput;

  const runpodUrl = hasValidLoras
    ? `https://api.runpod.ai/v2/${RUNPOD_MODEL_LORA}/run`
    : `https://api.runpod.ai/v2/${RUNPOD_MODEL}/run`;

  const response = await fetch(runpodUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${runpodApiKey}`,
    },
    body: JSON.stringify({ input: runInput }),
  });

  if (!response.ok) {
    const txt = await response.text();
    console.error("Runpod API error:", response.status, txt);
    return ResponseUtil.internalError(event, "Failed to submit I2V job");
  }

  const runpodResult = (await response.json()) as {
    id: string;
    status: string;
  };
  const jobId = runpodResult.id;
  const status = runpodResult.status || "IN_QUEUE";

  const now = new Date().toISOString();

  // Decrement user's credits by requested duration
  const creditsToUpdate =
    videoLength > userEntity.i2vCreditsSecondsPurchased!
      ? {
          i2vCreditsSecondsPurchased: 0,
          i2vCreditsSecondsFromPlan:
            (userEntity.i2vCreditsSecondsFromPlan ?? 0) -
            (videoLength - (userEntity.i2vCreditsSecondsPurchased ?? 0)),
        }
      : {
          i2vCreditsSecondsPurchased:
            (userEntity.i2vCreditsSecondsPurchased ?? 0) - videoLength,
        };
  try {
    await DynamoDBService.updateUser(auth.userId, creditsToUpdate);
  } catch (err) {
    console.error("Failed to decrement I2V credits:", err);
    return ResponseUtil.internalError(event, "Failed to update credits");
  }

  // Estimate execution time (seconds) using provided reference points
  // Heuristic: ~30s per video second at 1024x1024, mildly adjusted by size and settings
  const area = outWidth * outHeight;
  const baseArea = 1024 * 1024;
  const areaRatio = Math.max(0.5, Math.min(2.0, area / baseArea));
  // Mild negative exponent to reflect small size effect seen in samples
  const sizeFactor = Math.pow(areaRatio, -0.1);
  const stepsCfgFactor =
    1 + 0.002 * (inferenceSteps - 30) + 0.003 * (cfgScale - 5);
  const perSec = 30; // baseline seconds per output second
  const estimatedSeconds = Math.max(
    30,
    Math.round(perSec * videoLength * sizeFactor * stepsCfgFactor)
  );

  // Persist job entity
  const jobEntity: I2VJobEntity = {
    PK: `I2VJOB#${jobId}`,
    SK: "METADATA",
    GSI1PK: `I2VJOB_BY_USER#${auth.userId}`,
    GSI1SK: `${now}#${jobId}`,
    GSI2PK: `I2VJOB_BY_MEDIA#${mediaId}`,
    GSI2SK: `${now}#${jobId}`,
    GSI3PK: `I2VJOB_STATUS#${status}`,
    GSI3SK: `${now}#${jobId}`,
    GSI4PK: `I2VJOB_STATUS_USER#${auth.userId}#${status}`,
    GSI4SK: `${now}#${jobId}`,
    EntityType: "I2VJob",
    jobId,
    userId: auth.userId,
    mediaId,
    request: {
      videoLength,
      prompt: promptWithTriggers,
      negativePrompt,
      seed: String(seedNumber),
      flowShift,
      inferenceSteps,
      cfgScale,
      optimizePrompt,
      isPublic,
      enableLoras,
      width: outWidth,
      height: outHeight,
      selectedLoras: hasValidLoras
        ? resolvedLoras.map(({ name }) => name)
        : undefined,
      loraTriggerWords: triggerWords.length > 0 ? triggerWords : undefined,
      loraHighNoise: hasValidLoras ? storedHighNoiseLoras : undefined,
      loraLowNoise: hasValidLoras ? storedLowNoiseLoras : undefined,
    },
    status,
    submittedAt: now,
    updatedAt: now,
    estimatedCompletionTimeAt: new Date(
      Date.now() + estimatedSeconds * 1000
    ).toISOString(),
    estimatedSeconds,
    sourceImageUrl,
    runpodModel: hasValidLoras ? RUNPOD_MODEL_LORA : RUNPOD_MODEL,
  };

  await DynamoDBService.createI2VJob(jobEntity);

  // Send SQS delayed message to trigger polling around completion time
  try {
    const queueUrl = process.env["I2V_POLL_QUEUE_URL"];
    if (!queueUrl) {
      console.warn("I2V_POLL_QUEUE_URL not set; skipping delayed poll enqueue");
    } else {
      const sqs = new SQS();
      await sqs
        .sendMessage({
          QueueUrl: queueUrl,
          DelaySeconds: Math.max(0, Math.min(900, estimatedSeconds)),
          MessageBody: JSON.stringify({ jobId, delayIdx: 0 }),
        })
        .promise();
    }
  } catch (err) {
    console.error("Failed to enqueue delayed poll message:", err);
  }

  return ResponseUtil.created(event, { jobId, estimatedSeconds });
};

export const handler = LambdaHandlerUtil.withAuth(handleSubmitI2VJob, {
  requireBody: true,
});
