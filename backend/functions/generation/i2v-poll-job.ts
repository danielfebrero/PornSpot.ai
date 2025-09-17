import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ParameterStoreService } from "@shared/utils/parameters";
import { S3StorageService } from "@shared/services/s3-storage";
import { createMediaEntity } from "@shared/utils/media-entity";
import { I2VJobEntity, Media } from "@shared/shared-types";

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

  // Get job and verify ownership
  const job = await DynamoDBService.getI2VJob(jobId);
  if (!job) {
    return ResponseUtil.notFound(event, "Job not found");
  }
  if (job.userId !== auth.userId) {
    return ResponseUtil.forbidden(event, "Not allowed to access this job");
  }

  // If already completed and possibly processed, return final media if available
  if (job.status === "COMPLETED" && job.resultMediaId) {
    const mediaEntity = await DynamoDBService.findMediaById(job.resultMediaId);
    if (mediaEntity) {
      const media: Media =
        DynamoDBService.convertMediaEntityToMedia(mediaEntity);
      return ResponseUtil.success(event, {
        status: "COMPLETED",
        media,
      });
    }
  }

  // Fetch status from Runpod
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
    console.error("Runpod status error:", rpRes.status, txt);
    return ResponseUtil.internalError(event, "Failed to fetch job status");
  }

  const rpJson = (await rpRes.json()) as
    | {
        delayTime?: number;
        id: string;
        status: string;
        workerId?: string;
      }
    | {
        delayTime?: number;
        executionTime?: number;
        id: string;
        output: { cost?: number; result: string };
        status: "COMPLETED";
        workerId?: string;
      };

  const now = new Date().toISOString();

  // Update job with current status/delay/executionTime
  const baseUpdates: Partial<I2VJobEntity> = {
    status: (rpJson as any).status,
    updatedAt: now,
    GSI3PK: `I2VJOB_STATUS#${(rpJson as any).status}`,
  } as any;
  if ("delayTime" in rpJson && rpJson.delayTime !== undefined) {
    (baseUpdates as any).delayTime = rpJson.delayTime;
  }
  if (
    "executionTime" in rpJson &&
    (rpJson as any).executionTime !== undefined
  ) {
    (baseUpdates as any).executionTime = (rpJson as any).executionTime;
  }
  await DynamoDBService.updateI2VJob(jobId, baseUpdates);

  // If still in progress
  if ((rpJson as any).status !== "COMPLETED") {
    return ResponseUtil.success(event, {
      status: (rpJson as any).status,
      delayTime: (rpJson as any).delayTime ?? null,
    });
  }

  // Completed: download video, save to S3, create Media, update job
  const outputUrl = (rpJson as any).output?.result;
  if (!outputUrl) {
    console.error("Completed job missing output URL");
    return ResponseUtil.internalError(event, "Missing output result URL");
  }

  // Save to S3
  const s3 = S3StorageService.getInstance();
  const saved = await s3.saveI2VResultFromUrl(jobId, outputUrl, "video/mp4");

  // Create MediaEntity for result
  const mediaId = jobId; // reuse jobId for media id to keep linkage simple
  const relativeUrl = `/${saved.key}`;
  // Fetch source media to propagate dimensions into metadata
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

  // Update job with resultMediaId
  await DynamoDBService.updateI2VJob(jobId, {
    updatedAt: new Date().toISOString(),
    status: "COMPLETED",
    completedAt: new Date().toISOString(),
    resultMediaId: mediaId,
    GSI3PK: `I2VJOB_STATUS#COMPLETED`,
  } as any);

  const media: Media = DynamoDBService.convertMediaEntityToMedia(mediaEntity);
  return ResponseUtil.success(event, {
    status: "COMPLETED",
    media,
  });
};

export const handler = LambdaHandlerUtil.withAuth(handlePollI2VJob, {
  validateQueryParams: ["jobId"],
});
