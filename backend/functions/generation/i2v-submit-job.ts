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

const RUNPOD_MODEL = "wan-2-2-i2v-720";

const handleSubmitI2VJob = async (
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
  const prompt = ValidationUtil.validateRequiredString(body.prompt, "prompt");
  const negativePrompt = body.negativePrompt ?? "";
  const videoLength = body.videoLength as I2VSettings["videoLength"];
  const flowShift = body.flowShift;
  const inferenceSteps = body.inferenceSteps;
  const cfgScale = body.cfgScale;
  const optimizePrompt = !!body.optimizePrompt;
  const isPublic = body.isPublic === undefined ? true : !!body.isPublic;

  // Basic numeric validations (keep lightweight and fail fast)
  if (![5, 8, 10, 15, 20, 25, 30].includes(videoLength)) {
    return ResponseUtil.badRequest(
      event,
      "videoLength must be one of 5, 8, 10, 15, 20, 25, 30"
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

  const availableCredits = userEntity.i2vCreditsSeconds ?? 0;
  if (availableCredits < videoLength) {
    return ResponseUtil.forbidden(
      event,
      `Not enough I2V credits. Required: ${videoLength}s, Available: ${availableCredits}s`
    );
  }

  // Build full CDN URL (prepend as required)
  const sourceImageUrl = media.url.startsWith("http")
    ? media.url
    : `https://cdn.pornspot.ai${media.url}`;

  // Fetch Runpod API key
  const runpodApiKey = await ParameterStoreService.getRunpodApiKey();

  // Prepare Runpod payload
  // Seed rules: -1 for auto/random, otherwise clamp to [0, Number.MAX_SAFE_INTEGER]
  const MAX_SEED = Number.MAX_SAFE_INTEGER; // 9007199254740991
  let seedNumber: number = -1;
  const numericSeed = Number(body.seed);
  if (Number.isFinite(numericSeed)) {
    const floored = Math.floor(numericSeed);
    if (floored < -1) {
      seedNumber = -1;
    } else if (floored > MAX_SEED) {
      seedNumber = MAX_SEED;
    } else {
      seedNumber = floored;
    }
  } else {
    seedNumber = -1;
  }

  const runInput = {
    prompt,
    image: sourceImageUrl,
    num_inference_steps: inferenceSteps,
    guidance: cfgScale,
    negative_prompt: negativePrompt || "",
    size: "1024*1536", // Default size; can be adjusted later if needed
    duration: videoLength,
    flow_shift: flowShift,
    seed: seedNumber,
    enable_prompt_optimization: optimizePrompt,
    enable_safety_checker: false,
  };

  const response = await fetch(`https://api.runpod.ai/v2/${RUNPOD_MODEL}/run`, {
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
  try {
    await DynamoDBService.updateUser(auth.userId, {
      i2vCreditsSeconds: availableCredits - videoLength,
    });
  } catch (err) {
    console.error("Failed to decrement I2V credits:", err);
    return ResponseUtil.internalError(event, "Failed to update credits");
  }

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
    EntityType: "I2VJob",
    jobId,
    userId: auth.userId,
    mediaId,
    request: {
      videoLength,
      prompt,
      negativePrompt,
      seed: String(body.seed),
      flowShift,
      inferenceSteps,
      cfgScale,
      optimizePrompt,
      isPublic,
    },
    status,
    submittedAt: now,
    updatedAt: now,
    sourceImageUrl,
    runpodModel: RUNPOD_MODEL,
  };

  await DynamoDBService.createI2VJob(jobEntity);

  return ResponseUtil.created(event, { jobId });
};

export const handler = LambdaHandlerUtil.withAuth(handleSubmitI2VJob, {
  requireBody: true,
});
