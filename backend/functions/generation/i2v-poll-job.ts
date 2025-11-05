import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  SQSEvent,
  SQSRecord,
} from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ParameterStoreService } from "@shared/utils/parameters";
import {
  S3StorageService,
  UploadVideoPairResult,
} from "@shared/services/s3-storage";
import {
  createGenerationMetadata,
  createMediaEntity,
} from "@shared/utils/media-entity";
import { I2VJobEntity } from "@shared/shared-types";
import { SQS } from "aws-sdk";

const RUNPOD_MODEL = "wan-2-2-i2v-720"; // must match submit-job

const handlePollI2VJob = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod !== "GET") {
    return ResponseUtil.methodNotAllowed(event, "Only GET method allowed");
  }
  const jobId = event.queryStringParameters?.["jobId"];
  if (!jobId) {
    return ResponseUtil.badRequest(event, "jobId is required in query");
  }
  const job = await DynamoDBService.getI2VJob(jobId);
  if (!job) return ResponseUtil.notFound(event, "Job not found");
  if (job.userId !== auth.userId)
    return ResponseUtil.forbidden(event, "Not allowed to access this job");

  if (job.status === "FAILED") {
    await refundCreditsForFailedJob(job);
  }

  // Fast path: already finalized with media
  if (job.status === "COMPLETED" && job.resultMediaId) {
    const mediaEntity = await DynamoDBService.findMediaById(job.resultMediaId);
    if (mediaEntity) {
      return ResponseUtil.success(event, {
        status: "COMPLETED",
        media: DynamoDBService.convertMediaEntityToMedia(mediaEntity),
      });
    }
  }

  if (job.executionTime) {
    console.log(
      `Job ${jobId} has executionTime ${job.executionTime}s but not downloaded yet.`
    );
    return ResponseUtil.success(event, {
      status: job.status,
      delayTime: job.delayTime ?? null,
      executionTime: job.executionTime,
    });
  }

  // Reuse shared polling logic (single poll only for GET)
  try {
    const res = await pollOnce(jobId, job.runpodModel);
    if (!res.completed) {
      if (res.status === "FAILED") {
        await refundCreditsForFailedJob({ ...job, status: "FAILED" });
      }
      return ResponseUtil.success(event, {
        status: res.status,
        delayTime: job.delayTime ?? null,
      });
    }
    if (!res.resultUrl) {
      console.error("Completed job missing output URL");
      return ResponseUtil.internalError(event, "Missing output result URL");
    }
    await finalizeCompletedJob(job, res.resultUrl);
    await DynamoDBService.incrementUserProfileMetric(
      job.userId,
      "totalGeneratedMedias",
      1
    );
    const mediaEntity = await DynamoDBService.findMediaById(jobId);
    if (!mediaEntity) {
      return ResponseUtil.internalError(
        event,
        "Result media not found post finalize"
      );
    }
    return ResponseUtil.success(event, {
      status: "COMPLETED",
      media: DynamoDBService.convertMediaEntityToMedia(mediaEntity),
    });
  } catch (err) {
    console.error("Error during GET poll:", err);
    return ResponseUtil.internalError(event, "Failed to poll job status");
  }
};

// Unified Lambda entrypoint: handles both API Gateway GET and SQS events
export const handler = async (
  event: APIGatewayProxyEvent | SQSEvent,
  _context: any
): Promise<any> => {
  if ((event as APIGatewayProxyEvent).httpMethod) {
    // Preserve current behavior: single poll when invoked via GET
    const wrapped = LambdaHandlerUtil.withAuth(handlePollI2VJob, {
      validateQueryParams: ["jobId"],
    });
    return wrapped(event as APIGatewayProxyEvent);
  }
  if ((event as SQSEvent).Records) {
    await handleSqsEvent(event as SQSEvent);
    // SQS handler can return void
    return {};
  }
  console.warn("Unsupported event type for i2v-poll-job");
  return { statusCode: 400, body: "Unsupported event" };
};

// Backoff sequence 3/6/9/6/3/6/9... repeated
const BACKOFF = [3, 6, 9, 6, 3, 6, 9];

async function pollOnce(
  jobId: string,
  runpodModel?: string
): Promise<{
  status: string;
  completed: boolean;
  resultUrl?: string;
}> {
  const runpodApiKey = await ParameterStoreService.getRunpodApiKey();
  const resolvedModel = runpodModel?.trim() || RUNPOD_MODEL;
  const statusUrl = `https://api.runpod.ai/v2/${resolvedModel}/status/${encodeURIComponent(
    jobId
  )}`;
  const rpRes = await fetch(statusUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${runpodApiKey}`,
    },
  });
  if (!rpRes.ok) {
    const txt = await rpRes.text().catch(() => "");
    throw new Error(`Runpod status error: ${rpRes.status} ${txt}`);
  }
  const rpJson = (await rpRes.json()) as any;
  const now = new Date().toISOString();
  const baseUpdates: Partial<I2VJobEntity> = {
    status: rpJson.status,
    updatedAt: now,
    GSI3PK: `I2VJOB_STATUS#${rpJson.status}`,
  } as any;
  if (rpJson.delayTime !== undefined)
    (baseUpdates as any).delayTime = rpJson.delayTime;
  if (rpJson.executionTime !== undefined)
    (baseUpdates as any).executionTime = rpJson.executionTime;
  await DynamoDBService.updateI2VJob(jobId, baseUpdates);
  if (rpJson.status !== "COMPLETED") {
    return { status: rpJson.status, completed: false };
  }
  const outputUrl = rpJson.output?.result;
  return { status: "COMPLETED", completed: true, resultUrl: outputUrl };
}

async function finalizeCompletedJob(job: I2VJobEntity, outputUrl: string) {
  const s3 = S3StorageService.getInstance();
  const jobId = job.jobId;
  const sourceMedia = await DynamoDBService.getMedia(job.mediaId);
  const isVideoExtension =
    job.mode === "video-extension" ||
    job.sourceMediaType === "video" ||
    sourceMedia?.type === "video";
  const cdnBaseUrl = "https://cdn.pornspot.ai";
  const toAbsoluteUrl = (value?: string | null): string | null => {
    if (!value) return null;
    if (value.startsWith("http")) return value;
    return value.startsWith("/")
      ? `${cdnBaseUrl}${value}`
      : `${cdnBaseUrl}/${value}`;
  };

  let savedPair: UploadVideoPairResult;
  if (isVideoExtension) {
    const baseVideoUrl =
      job.sourceVideoUrl ||
      toAbsoluteUrl(sourceMedia?.url) ||
      toAbsoluteUrl(sourceMedia?.optimizedVideoUrl);

    if (!baseVideoUrl) {
      console.error("Missing base video URL for concatenation", {
        jobId,
        mediaId: job.mediaId,
      });
      savedPair = await s3.saveI2VResultFromUrl(jobId, outputUrl, "video/mp4");
    } else {
      try {
        savedPair = await s3.saveI2VConcatenatedVideo(
          jobId,
          baseVideoUrl,
          outputUrl
        );
      } catch (error) {
        console.error("Failed to concatenate videos; falling back", {
          jobId,
          mediaId: job.mediaId,
          error,
        });
        savedPair = await s3.saveI2VResultFromUrl(
          jobId,
          outputUrl,
          "video/mp4"
        );
      }
    }
  } else {
    savedPair = await s3.saveI2VResultFromUrl(jobId, outputUrl, "video/mp4");
  }
  const mediaId = jobId;
  const relativeUrl = `/${savedPair.mp4.key}`;
  const optimizedWebmRelative = savedPair.webm
    ? `/${savedPair.webm.key}`
    : undefined;
  const metaWidth =
    job.request?.width ??
    (sourceMedia?.metadata as any)?.width ??
    sourceMedia?.width;

  const highLorasScales =
    job.request?.loraHighNoise && job.request.loraHighNoise.length > 0
      ? job.request.loraHighNoise.reduce(
          (
            acc: Record<string, { mode: "auto" | "manual"; value: number }>,
            entry
          ) => {
            if (!entry?.id) {
              return acc;
            }
            acc[entry.id] = {
              mode: entry.mode ?? "auto",
              value: entry.scale,
            };
            return acc;
          },
          {}
        )
      : undefined;

  const lowLorasScales =
    job.request?.loraLowNoise && job.request.loraLowNoise.length > 0
      ? job.request.loraLowNoise.reduce(
          (
            acc: Record<string, { mode: "auto" | "manual"; value: number }>,
            entry
          ) => {
            if (!entry?.id) {
              return acc;
            }
            acc[entry.id] = {
              mode: entry.mode ?? "auto",
              value: entry.scale,
            };
            return acc;
          },
          {}
        )
      : undefined;
  const metaHeight =
    job.request?.height ??
    (sourceMedia?.metadata as any)?.height ??
    sourceMedia?.height;

  // Calculate video length for extensions
  let videoLengthSeconds: number | undefined;
  let extendedFromMediaId: string | undefined;
  let extendedBySeconds: number | undefined;

  if (isVideoExtension) {
    const previousVideoLength = Number(
      (sourceMedia?.metadata as any)?.videoLengthSeconds ?? 0
    );
    const extensionSeconds = Number(job.request?.videoLength ?? 0);
    const totalDuration = Number.isFinite(previousVideoLength)
      ? previousVideoLength +
        (Number.isFinite(extensionSeconds) ? extensionSeconds : 0)
      : Number.isFinite(extensionSeconds)
      ? extensionSeconds
      : undefined;

    if (totalDuration && totalDuration > 0) {
      videoLengthSeconds = totalDuration;
      extendedFromMediaId = job.mediaId;
      extendedBySeconds = extensionSeconds;
    }
  } else {
    // For new I2V videos (not extensions), use the requested video length
    const requestedLength = Number(job.request?.videoLength ?? 0);
    if (Number.isFinite(requestedLength) && requestedLength > 0) {
      videoLengthSeconds = requestedLength;
    }
  }

  const metadata = createGenerationMetadata({
    prompt: job.request?.prompt,
    negativePrompt: job.request?.negativePrompt,
    width: metaWidth,
    height: metaHeight,
    generationId: jobId,
    selectedLoras: job.request?.selectedLoras,
    highLorasScales,
    lowLorasScales,
    batchCount: 1,
    cfgScale: job.request?.cfgScale,
    steps: job.request?.inferenceSteps,
    seed: Number(job.request?.seed),
    originalMediaId: job.mediaId,
    videoLengthSeconds,
    extendedFromMediaId,
    extendedBySeconds,
  });

  const mediaEntity = createMediaEntity({
    mediaId,
    userId: job.userId,
    filename: savedPair.mp4.key,
    originalFilename: sourceMedia?.originalFilename || "Video",
    mimeType: "video/mp4",
    url: relativeUrl,
    size: savedPair.mp4.size,
    isPublic: job.request?.isPublic !== undefined ? job.request.isPublic : true,
    status: "uploaded",
    createdByType: "user",
    type: "video",
    metadata: metadata,
    thumbnailUrl: sourceMedia?.thumbnailUrl,
    thumbnailUrls: sourceMedia?.thumbnailUrls,
    optimizedVideoUrl: optimizedWebmRelative,
  });
  await DynamoDBService.createMedia(mediaEntity);
  if (job.baseFrameKey) {
    s3.deleteImage(job.baseFrameKey).catch((error) =>
      console.warn("Failed to clean up base frame image", {
        jobId,
        key: job.baseFrameKey,
        error,
      })
    );
  }
  await DynamoDBService.updateI2VJob(jobId, {
    updatedAt: new Date().toISOString(),
    status: "COMPLETED",
    completedAt: new Date().toISOString(),
    resultMediaId: mediaId,
    GSI3PK: `I2VJOB_STATUS#COMPLETED`,
  } as any);
}

const handleSqsEvent = async (event: SQSEvent) => {
  const sqs = new SQS();
  const queueUrl = process.env["I2V_POLL_QUEUE_URL"];
  for (const record of event.Records as SQSRecord[]) {
    try {
      const body = JSON.parse(record.body) as {
        jobId: string;
        delayIdx?: number;
      };
      const { jobId } = body;
      const delayIdx = typeof body.delayIdx === "number" ? body.delayIdx : 0;
      const job = await DynamoDBService.getI2VJob(jobId);
      if (!job) {
        console.warn("I2V job not found for SQS message", jobId);
        continue;
      }
      if (job.status === "FAILED") {
        await refundCreditsForFailedJob(job);
        console.log(
          "I2V job failed; refund processed or already handled",
          jobId
        );
        continue;
      }
      if (job.status === "CANCELLED") {
        console.log("I2V job in terminal state; skipping", jobId, job.status);
        continue;
      }
      if (job.status === "COMPLETED" && job.resultMediaId) {
        continue; // nothing to do
      }
      const res = await pollOnce(jobId, job.runpodModel);
      if (!res.completed) {
        if (res.status === "FAILED") {
          await refundCreditsForFailedJob({ ...job, status: "FAILED" });
          console.log("I2V job failed during polling; refund processed", jobId);
          continue;
        }
        if (res.status === "CANCELLED") {
          console.log(
            "I2V job cancelled during polling; skipping re-enqueue",
            jobId
          );
          continue;
        }
        if (res.status !== "IN_PROGRESS" && res.status !== "PENDING") {
          console.warn(
            "I2V job in unexpected non-terminal state; skipping re-enqueue",
            jobId,
            res.status
          );
          continue;
        }
        // Not done, schedule next backoff
        if (!queueUrl) {
          console.warn("I2V_POLL_QUEUE_URL not set; cannot re-enqueue");
          continue;
        }
        const nextIdx = (delayIdx + 1) % BACKOFF.length;
        const delaySeconds = BACKOFF[nextIdx];
        await sqs
          .sendMessage({
            QueueUrl: queueUrl,
            DelaySeconds: delaySeconds,
            MessageBody: JSON.stringify({ jobId, delayIdx: nextIdx }),
          })
          .promise();
        continue;
      }
      // Completed: finalize (idempotent-ish)
      if (!res.resultUrl) {
        console.error("COMPLETED job missing resultUrl", jobId);
        continue;
      }
      await finalizeCompletedJob(job, res.resultUrl);
    } catch (err) {
      console.error("Error processing I2V SQS record:", err);
    }
  }
};

async function refundCreditsForFailedJob(job: I2VJobEntity): Promise<void> {
  if (job.status !== "FAILED") {
    return;
  }

  const videoLength = Number(job.request?.videoLength ?? 0);
  if (!Number.isFinite(videoLength) || videoLength <= 0) {
    return;
  }

  try {
    const refunded = await DynamoDBService.refundI2VJobCredits(
      job,
      videoLength
    );
    if (!refunded) {
      console.log("Refund already processed for I2V job", job.jobId);
    }
  } catch (error) {
    console.error("Failed to refund credits for I2V job", {
      jobId: job.jobId,
      userId: job.userId,
      error,
    });
  }
}
