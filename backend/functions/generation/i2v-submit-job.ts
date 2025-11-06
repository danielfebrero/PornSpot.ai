import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ValidationUtil } from "@shared/utils/validation";
import { I2VJobEntity, I2VSubmitJobRequest } from "@shared/shared-types";
import { PlanUtil } from "@shared/utils/plan";
import { SQSService } from "@shared/services/sqs";
import { v4 as uuidv4 } from "uuid";

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
  const videoLength = body.videoLength;
  const flowShift = body.flowShift;
  const inferenceSteps = body.inferenceSteps;
  const cfgScale = body.cfgScale;
  const enableLoras =
    body.enableLoras === undefined ? true : !!body.enableLoras;

  // Basic numeric validations (keep lightweight and fail fast)
  if (![5, 8, 10, 15, 20, 25, 30].includes(videoLength)) {
    return ResponseUtil.badRequest(
      event,
      "videoLength must be one of 5, 8, 10, 15, 20, 25, 30"
    );
  }
  if (enableLoras && ![5].includes(videoLength)) {
    return ResponseUtil.badRequest(
      event,
      "LoRA-enabled videos must use a length of 5 seconds"
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

  // Get source media - just verify it exists
  const media = await DynamoDBService.getMedia(mediaId);
  if (!media) {
    return ResponseUtil.notFound(event, "Source media not found");
  }

  const hasAccessibleUrl =
    Boolean(media.url) || Boolean(media.optimizedVideoUrl);
  if (!hasAccessibleUrl) {
    return ResponseUtil.notFound(event, "Source media missing accessible URL");
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

  // Generate UUID for job immediately
  const jobId = uuidv4();
  const now = new Date().toISOString();

  const isVideoSource = media.type === "video";
  const jobMode: "image-to-video" | "video-extension" = isVideoSource
    ? "video-extension"
    : "image-to-video";

  // Determine the original media ID (preserve from chain or use current for new I2V)
  let originalMediaId: string | undefined;
  if (isVideoSource) {
    // For video extensions, preserve the originalMediaId from the source video's metadata
    originalMediaId = (media.metadata as any)?.originalMediaId;
    if (!originalMediaId) {
      console.warn(
        `Video ${mediaId} missing originalMediaId in metadata; using mediaId as fallback`
      );
      originalMediaId = mediaId;
    }
  } else {
    // For new image-to-video, the original media is the image itself
    originalMediaId = mediaId;
  }

  // Decrement user's credits by requested duration BEFORE creating job
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

  // Estimate execution time (rough estimate for user feedback)
  const estimatedSeconds = Math.max(30, videoLength * 30);

  // Create job entity with SUBMITTING status - store raw request data
  const jobEntity: I2VJobEntity = {
    PK: `I2VJOB#${jobId}`,
    SK: "METADATA",
    GSI1PK: `I2VJOB_BY_USER#${auth.userId}`,
    GSI1SK: `${now}#${jobId}`,
    GSI2PK: `I2VJOB_BY_MEDIA#${mediaId}`,
    GSI2SK: `${now}#${jobId}`,
    GSI3PK: `I2VJOB_STATUS#SUBMITTING`,
    GSI3SK: `${now}#${jobId}`,
    GSI4PK: `I2VJOB_STATUS_USER#${auth.userId}#SUBMITTING`,
    GSI4SK: `${now}#${jobId}`,
    EntityType: "I2VJob",
    jobId,
    userId: auth.userId,
    mediaId,
    originalMediaId,
    mode: jobMode,
    sourceMediaType: isVideoSource ? "video" : "image",
    request: {
      videoLength,
      prompt: body.prompt ?? "",
      negativePrompt: body.negativePrompt ?? "",
      seed: "-1", // Will be generated in process-runpod
      flowShift,
      inferenceSteps,
      cfgScale,
      optimizePrompt: !!body.optimizePrompt,
      isPublic: body.isPublic === undefined ? true : !!body.isPublic,
      enableLoras,
      width: 0, // Will be calculated in process-runpod
      height: 0, // Will be calculated in process-runpod
      mode: jobMode,
    },
    status: "SUBMITTING",
    submittedAt: now,
    updatedAt: now,
    estimatedCompletionTimeAt: new Date(
      Date.now() + estimatedSeconds * 1000
    ).toISOString(),
    estimatedSeconds,
    sourceImageUrl: "", // Will be set in process-runpod
    runpodModel: "", // Will be determined in process-runpod
    submissionAttempts: 0,
  };

  await DynamoDBService.createI2VJob(jobEntity);

  // Update user's lastGenerationAt and streak
  await PlanUtil.updateLastGenerationForVideo(auth.userId);

  // Send RAW data to processing queue for ALL heavy operations
  const processQueueUrl = process.env["I2V_PROCESS_RUNPOD_QUEUE_URL"];
  if (!processQueueUrl) {
    throw new Error("I2V_PROCESS_RUNPOD_QUEUE_URL not configured");
  }

  await SQSService.sendMessage(processQueueUrl, {
    jobId,
    userId: auth.userId,
    mediaId,
    mode: jobMode,
    rawRequest: {
      prompt: body.prompt ?? "",
      negativePrompt: body.negativePrompt ?? "",
      videoLength,
      seed: body.seed,
      flowShift,
      inferenceSteps,
      cfgScale,
      optimizePrompt: !!body.optimizePrompt,
      enableLoras,
    },
    mediaUrl: media.url || media.optimizedVideoUrl,
    mediaType: media.type,
    mediaMetadata: media.metadata,
    mediaWidth: media.width,
    mediaHeight: media.height,
    mediaThumbnailUrl: media.thumbnailUrl,
    mediaThumbnailUrls: media.thumbnailUrls,
    estimatedSeconds,
  });

  return ResponseUtil.created(event, { jobId, estimatedSeconds });
};

export const handler = LambdaHandlerUtil.withAuth(handleSubmitI2VJob, {
  requireBody: true,
});
