import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { ResponseUtil } from "@shared/utils/response";
import { ValidationUtil } from "@shared/utils/validation";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { I2VJobEntity } from "@shared/shared-types";

const NON_CLEARABLE_STATUSES = new Set<I2VJobEntity["status"]>(["COMPLETED"]);

type ClearJobPayload = {
  jobId?: string;
};

function extractJobId(event: APIGatewayProxyEvent): string | null {
  const queryJobId = event.queryStringParameters?.["jobId"];
  if (queryJobId) {
    return queryJobId;
  }

  if (!event.body) {
    return null;
  }

  try {
    const payload = JSON.parse(event.body) as ClearJobPayload;
    return payload.jobId ?? null;
  } catch (error) {
    console.error("Failed to parse clear job payload", error);
    return null;
  }
}

const handleClearI2VJob = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod !== "DELETE") {
    return ResponseUtil.methodNotAllowed(event, "Only DELETE method allowed");
  }

  const rawJobId = extractJobId(event);
  if (!rawJobId) {
    return ResponseUtil.badRequest(event, "jobId is required");
  }

  const jobId = ValidationUtil.validateRequiredString(rawJobId, "jobId");

  const job = await DynamoDBService.getI2VJob(jobId);
  if (!job) {
    return ResponseUtil.notFound(event, "Job not found");
  }

  if (job.userId !== auth.userId) {
    return ResponseUtil.forbidden(event, "Not allowed to clear this job");
  }

  if (job.status && NON_CLEARABLE_STATUSES.has(job.status)) {
    return ResponseUtil.badRequest(event, "Completed jobs cannot be cleared");
  }

  try {
    await DynamoDBService.deleteI2VJob(job.jobId);
  } catch (error) {
    console.error("Failed to delete I2V job", {
      jobId,
      userId: auth.userId,
      error,
    });
    return ResponseUtil.internalError(event, "Failed to clear job");
  }

  return ResponseUtil.success(event, {
    jobId,
    status: "CLEARED",
  });
};

export const handler = LambdaHandlerUtil.withAuth(handleClearI2VJob, {});
