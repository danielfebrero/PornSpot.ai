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
import { S3StorageService } from "@shared/services/s3-storage";
import { createMediaEntity } from "@shared/utils/media-entity";
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
    const res = await pollOnce(jobId);
    if (!res.completed) {
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
      auth.userId,
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

async function pollOnce(jobId: string): Promise<{
  status: string;
  completed: boolean;
  resultUrl?: string;
}> {
  const runpodApiKey = await ParameterStoreService.getRunpodApiKey();
  const statusUrl = `https://api.runpod.ai/v2/${RUNPOD_MODEL}/status/${encodeURIComponent(
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
  const saved = await s3.saveI2VResultFromUrl(jobId, outputUrl, "video/mp4");
  const mediaId = jobId;
  const relativeUrl = `/${saved.key}`;
  const sourceMedia = await DynamoDBService.getMedia(job.mediaId);
  const metaWidth = (sourceMedia?.metadata as any)?.width ?? sourceMedia?.width;
  const metaHeight =
    (sourceMedia?.metadata as any)?.height ?? sourceMedia?.height;
  const mediaEntity = createMediaEntity({
    mediaId,
    userId: job.userId,
    filename: saved.key,
    originalFilename: `${jobId}.mp4`,
    mimeType: "video/mp4",
    url: relativeUrl,
    size: saved.size,
    isPublic: job.request?.isPublic !== undefined ? job.request.isPublic : true,
    status: "uploaded",
    createdByType: "user",
    type: "video",
    metadata: {
      isGenerated: true,
      generationId: jobId,
      prompt: job.request?.prompt,
      negativePrompt: job.request?.negativePrompt,
      duration: job.request?.videoLength,
      width: typeof metaWidth === "number" ? metaWidth : undefined,
      height: typeof metaHeight === "number" ? metaHeight : undefined,
      source: "i2v",
      model: job.runpodModel,
    } as any,
  });
  await DynamoDBService.createMedia(mediaEntity);
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
      if (job.status === "COMPLETED" && job.resultMediaId) {
        continue; // nothing to do
      }
      const res = await pollOnce(jobId);
      if (!res.completed) {
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
