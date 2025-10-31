import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { ResponseUtil } from "@shared/utils/response";
import { QueryCommand, QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { I2VJobEntity } from "@shared/shared-types";
import { DynamoDBService } from "@shared/utils/dynamodb";

const client = new DynamoDBClient({});
const TABLE_NAME = process.env["DYNAMODB_TABLE"]!;
const FAILED_STATUS = ["FAILED"] as const;

type FailedI2VStatus = (typeof FAILED_STATUS)[number];

interface FailedJobResponseItem {
  jobId: string;
  submittedAt?: string;
  failedAt?: string;
  estimatedSeconds?: number;
  media: any;
  retryJobId?: string;
}

async function queryJobsForStatus(
  userId: string,
  status: FailedI2VStatus
): Promise<I2VJobEntity[]> {
  const input: QueryCommandInput = {
    TableName: TABLE_NAME,
    IndexName: "GSI4",
    KeyConditionExpression: "GSI4PK = :pk",
    ExpressionAttributeValues: {
      ":pk": `I2VJOB_STATUS_USER#${userId}#${status}`,
    },
  };

  const cmd = new QueryCommand(input);
  const res: any = await (client as any).send(cmd);
  return (res.Items as I2VJobEntity[]) || [];
}

const handleGetFailedI2VJobs = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod !== "GET") {
    return ResponseUtil.methodNotAllowed(event, "Only GET method allowed");
  }

  try {
    const all: I2VJobEntity[] = [];
    for (const status of FAILED_STATUS) {
      const items = await queryJobsForStatus(auth.userId, status);
      items.forEach((item) => {
        if (item.status === status) {
          all.push(item);
        }
      });
    }

    const mediaIdSet = new Set(all.map((job) => job.mediaId).filter(Boolean));

    // Batch fetch all media at once instead of sequential lookups
    const mediaList = await DynamoDBService.batchGetMediaByIds(
      Array.from(mediaIdSet)
    );

    // Create a map for quick lookup
    const mediaMap: Record<string, any> = {};
    Array.from(mediaIdSet).forEach((mediaId, index) => {
      if (mediaList[index]) {
        mediaMap[mediaId] = mediaList[index];
      }
    });

    let responseItems: FailedJobResponseItem[] = all.map((job) => ({
      jobId: job.jobId,
      submittedAt: job.submittedAt,
      failedAt: job.updatedAt,
      estimatedSeconds: job.estimatedSeconds,
      media: mediaMap[job.mediaId] || null,
      retryJobId: job.retryJobId,
    }));

    responseItems = responseItems.sort((a, b) => {
      const ta = a.failedAt ? Date.parse(a.failedAt) : 0;
      const tb = b.failedAt ? Date.parse(b.failedAt) : 0;
      return tb - ta;
    });

    return ResponseUtil.success(event, responseItems);
  } catch (error) {
    console.error("Failed to fetch failed I2V jobs", error);
    return ResponseUtil.internalError(event, "Failed to fetch failed jobs");
  }
};

export const handler = LambdaHandlerUtil.withAuth(handleGetFailedI2VJobs, {});
