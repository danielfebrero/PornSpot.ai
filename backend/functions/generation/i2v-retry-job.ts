import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { ResponseUtil } from "@shared/utils/response";
import { ValidationUtil } from "@shared/utils/validation";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { I2VSubmitJobRequest, I2VJobEntity } from "@shared/shared-types";
import { handleSubmitI2VJob } from "./i2v-submit-job";

const RETRIED_STATUS = "RETRIED";

const handleRetryI2VJob = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod !== "POST") {
    return ResponseUtil.methodNotAllowed(event, "Only POST method allowed");
  }

  if (!event.body) {
    return ResponseUtil.badRequest(
      event,
      ValidationUtil.MESSAGES.REQUIRED_BODY
    );
  }

  let payload: { jobId?: string };
  try {
    payload = JSON.parse(event.body);
  } catch {
    return ResponseUtil.badRequest(event, ValidationUtil.MESSAGES.INVALID_JSON);
  }

  const jobId = ValidationUtil.validateRequiredString(payload.jobId, "jobId");

  const existingJob = await DynamoDBService.getI2VJob(jobId);
  if (!existingJob) {
    return ResponseUtil.notFound(event, "Job not found");
  }
  if (existingJob.userId !== auth.userId) {
    return ResponseUtil.forbidden(event, "Not allowed to retry this job");
  }
  if (existingJob.status !== "FAILED") {
    return ResponseUtil.badRequest(event, "Job is not in a failed state");
  }
  if (!existingJob.mediaId) {
    return ResponseUtil.internalError(event, "Job missing source media");
  }
  if (!existingJob.request) {
    return ResponseUtil.internalError(event, "Job request snapshot missing");
  }
  if (existingJob.retryJobId) {
    return ResponseUtil.error(event, "Job already retried", 409);
  }

  const requestSnapshot = existingJob.request;
  const retryRequest: I2VSubmitJobRequest = {
    mediaId: existingJob.mediaId,
    prompt: requestSnapshot.prompt ?? "",
    negativePrompt: requestSnapshot.negativePrompt ?? "",
    seed: requestSnapshot.seed ?? "0",
    flowShift: requestSnapshot.flowShift ?? 5,
    inferenceSteps: requestSnapshot.inferenceSteps ?? 30,
    cfgScale: requestSnapshot.cfgScale ?? 5,
    optimizePrompt: false,
    isPublic:
      requestSnapshot.isPublic === undefined
        ? true
        : Boolean(requestSnapshot.isPublic),
    videoLength: requestSnapshot.videoLength,
  };

  if (!retryRequest.videoLength) {
    return ResponseUtil.internalError(
      event,
      "Job snapshot missing video length"
    );
  }

  try {
    await DynamoDBService.refundI2VJobCredits(
      existingJob as I2VJobEntity,
      retryRequest.videoLength
    );
  } catch (error) {
    console.error("Failed to refund credits before retry", {
      jobId,
      userId: auth.userId,
      error,
    });
  }

  const submitEvent: APIGatewayProxyEvent = {
    ...event,
    httpMethod: "POST",
    body: JSON.stringify(retryRequest),
  };

  const submitResult = await handleSubmitI2VJob(submitEvent, auth);
  if (submitResult.statusCode >= 400) {
    return submitResult;
  }

  let submitData: { jobId?: string; estimatedSeconds?: number } = {};
  try {
    submitData = submitResult.body ? JSON.parse(submitResult.body) : {};
  } catch (error) {
    console.error("Failed to parse submit job response", error);
  }

  const newJobId = submitData.jobId;
  if (!newJobId) {
    return ResponseUtil.internalError(
      event,
      "Retry submission did not return a job id"
    );
  }

  const newJob = await DynamoDBService.getI2VJob(newJobId);
  if (!newJob) {
    return ResponseUtil.internalError(
      event,
      "Failed to load retried job details"
    );
  }

  const now = new Date().toISOString();
  await DynamoDBService.updateI2VJob(existingJob.jobId, {
    status: RETRIED_STATUS,
    updatedAt: now,
    GSI3PK: `I2VJOB_STATUS#${RETRIED_STATUS}`,
    GSI4PK: `I2VJOB_STATUS_USER#${auth.userId}#${RETRIED_STATUS}`,
    GSI3SK: `${now}#${existingJob.jobId}`,
    GSI4SK: `${now}#${existingJob.jobId}`,
    retryJobId: newJobId,
  } as Partial<I2VJobEntity>);

  await DynamoDBService.updateI2VJob(newJobId, {
    retryOfJobId: existingJob.jobId,
  } as Partial<I2VJobEntity>);

  const media = await DynamoDBService.getMedia(existingJob.mediaId);

  return ResponseUtil.success(event, {
    previousJobId: existingJob.jobId,
    job: {
      jobId: newJob.jobId,
      submittedAt: newJob.submittedAt,
      estimatedSeconds: newJob.estimatedSeconds,
      estimatedCompletionTimeAt: newJob.estimatedCompletionTimeAt,
      media: media || null,
      retryOfJobId: existingJob.jobId,
    },
  });
};

export const handler = LambdaHandlerUtil.withAuth(handleRetryI2VJob, {
  requireBody: true,
});
