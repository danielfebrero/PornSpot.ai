import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { ResponseUtil } from "@shared/utils/response";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { QueryCommand, QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import { I2VJobEntity } from "@shared/shared-types";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

// We only need a lightweight doc client for this specialized query; reuse pattern from dynamodb util if desired.
// To avoid importing internal docClient, instantiate a minimal client here (cost is negligible for Lambda execution).
const client = new DynamoDBClient({});
const TABLE_NAME = process.env["DYNAMODB_TABLE"]!;

// Incomplete statuses we care about (anything not COMPLETED). FAILED jobs are excluded per requirement wording "not COMPLETED".
const INCOMPLETE_STATUSES = ["IN_QUEUE", "IN_PROGRESS"] as const;

interface IncompleteJobResponseItem {
  jobId: string;
  submittedAt?: string;
  estimatedSeconds?: number;
  estimatedCompletionTimeAt?: string;
  media: any; // Media (API shape) for source image referenced by job.mediaId
}

async function queryJobsForStatus(
  userId: string,
  status: string
): Promise<I2VJobEntity[]> {
  const input: QueryCommandInput = {
    TableName: TABLE_NAME,
    IndexName: "GSI4", // Assumes GSI4 is defined for GSI4PK / GSI4SK
    KeyConditionExpression: "GSI4PK = :pk",
    ExpressionAttributeValues: {
      ":pk": `I2VJOB_STATUS_USER#${userId}#${status}`,
    },
  };
  const cmd = new QueryCommand(input);
  const res: any = await (client as any).send(cmd);
  return (res.Items as I2VJobEntity[]) || [];
}

const handleGetIncompleteI2VJobs = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod !== "GET") {
    return ResponseUtil.methodNotAllowed(event, "Only GET method allowed");
  }

  try {
    // Aggregate across statuses
    const all: I2VJobEntity[] = [];
    for (const status of INCOMPLETE_STATUSES) {
      const items = await queryJobsForStatus(auth.userId, status);
      // Filter out any that became COMPLETED due to eventual consistency
      items.forEach((j) => {
        if (
          j.status !== "COMPLETED" &&
          j.status !== "FAILED" &&
          j.status !== "CANCELLED"
        )
          all.push(j);
      });
    }

    // Fetch distinct media entities (source images) in batch.
    const mediaIdSet = new Set(all.map((j) => j.mediaId).filter(Boolean));
    const mediaIdsArray = Array.from(mediaIdSet);

    // Batch fetch all media at once instead of sequential lookups
    const mediaList = await DynamoDBService.batchGetMediaByIds(mediaIdsArray);

    // Create a map for quick lookup
    const mediaMap: Record<string, any> = {};
    mediaIdsArray.forEach((mediaId, index) => {
      if (mediaList[index]) {
        mediaMap[mediaId] = mediaList[index];
      }
    });

    // Shape response
    let responseItems: IncompleteJobResponseItem[] = all.map((job) => ({
      jobId: job.jobId,
      submittedAt: job.submittedAt,
      estimatedSeconds: job.estimatedSeconds,
      estimatedCompletionTimeAt: job.estimatedCompletionTimeAt,
      media: mediaMap[job.mediaId] || null,
    }));

    // Sort by estimatedCompletionTimeAt ascending (earliest finishing first? Requirement: first should be latest to be completed -> so descending)
    // Requirement states: "sorted by estimatedCompletionTimeAt (the first in the list being the latest to be completed)" => sort descending.
    responseItems = responseItems.sort((a, b) => {
      const ta = a.estimatedCompletionTimeAt
        ? Date.parse(a.estimatedCompletionTimeAt)
        : 0;
      const tb = b.estimatedCompletionTimeAt
        ? Date.parse(b.estimatedCompletionTimeAt)
        : 0;
      return tb - ta; // latest (largest timestamp) first
    });

    return ResponseUtil.success(event, responseItems);
  } catch (err: any) {
    console.error("Failed to fetch incomplete I2V jobs", err);
    return ResponseUtil.internalError(event, "Failed to fetch incomplete jobs");
  }
};

export const handler = LambdaHandlerUtil.withAuth(
  handleGetIncompleteI2VJobs,
  {}
);
