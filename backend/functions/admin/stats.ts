/*
File objective: Provide platform-wide aggregate stats for admin dashboard.
Auth: Requires admin auth via LambdaHandlerUtil.withAdminAuth.
Special notes:
- Uses DynamoDB GSI1 to count albums
- Uses DynamoDB GSI2 to count total media with GSIPK2 = MEDIA_ID (direct COUNT query)
- Calculates public album count via FilterExpression
- Optionally computes S3 storage usage with ListObjectsV2; tolerant to S3 errors
- LocalStack-aware client configuration for local development
*/
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import {
  LambdaHandlerUtil,
  AdminAuthResult,
} from "@shared/utils/lambda-handler";

const isLocal = process.env["AWS_SAM_LOCAL"] === "true";

interface DynamoDBClientConfig {
  endpoint?: string;
  region?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

interface S3ClientConfig {
  endpoint?: string;
  region?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  forcePathStyle?: boolean;
}

// DynamoDB client setup
const clientConfig: DynamoDBClientConfig = {};
if (isLocal) {
  clientConfig.endpoint = "http://pornspot-local-aws:4566";
  clientConfig.region = "us-east-1";
  clientConfig.credentials = {
    accessKeyId: "test",
    secretAccessKey: "test",
  };
}

const client = new DynamoDBClient(clientConfig);
const docClient = DynamoDBDocumentClient.from(client);

// S3 client setup
let s3Config: S3ClientConfig = {};
if (isLocal) {
  s3Config = {
    endpoint: "http://pornspot-local-aws:4566",
    region: process.env["AWS_REGION"] || "us-east-1",
    credentials: {
      accessKeyId: "test",
      secretAccessKey: "test",
    },
    forcePathStyle: true,
  };
}

const s3Client = new S3Client(s3Config);

const TABLE_NAME = process.env["DYNAMODB_TABLE"]!;
const BUCKET_NAME = isLocal
  ? "local-pornspot-media"
  : process.env["S3_BUCKET"]!;

const handleGetStats = async (
  event: APIGatewayProxyEvent,
  auth: AdminAuthResult
): Promise<APIGatewayProxyResult> => {
  // Get total albums count
  const albumsResult = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: {
        ":gsi1pk": "ALBUM",
      },
      Select: "COUNT",
    })
  );

  const totalAlbums = albumsResult.Count || 0;

  // Get public albums count
  const publicAlbumsResult = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      FilterExpression: "isPublic = :isPublic",
      ExpressionAttributeValues: {
        ":gsi1pk": "ALBUM",
        ":isPublic": "true",
      },
      Select: "COUNT",
    })
  );

  const publicAlbums = publicAlbumsResult.Count || 0;

  // Get total media count using GSI2 with MEDIA_ID
  const mediaResult = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI2",
      KeyConditionExpression: "GSI2PK = :gsi2pk",
      ExpressionAttributeValues: {
        ":gsi2pk": "MEDIA_ID",
      },
      Select: "COUNT",
    })
  );

  const totalMedia = mediaResult.Count || 0;

  // Get storage used from S3
  let storageUsed = 0;
  let s3LastKey: string | undefined;

  try {
    do {
      const s3Result = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: BUCKET_NAME,
          ContinuationToken: s3LastKey,
        })
      );

      if (s3Result.Contents) {
        for (const object of s3Result.Contents) {
          storageUsed += object.Size || 0;
        }
      }

      s3LastKey = s3Result.NextContinuationToken;
    } while (s3LastKey);
  } catch (error) {
    console.warn("Could not calculate storage usage:", error);
    // Continue without storage data if S3 is not accessible
  }

  // Format storage size
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const stats = {
    totalAlbums,
    totalMedia,
    publicAlbums,
    storageUsed: formatBytes(storageUsed),
    storageUsedBytes: storageUsed,
  };

  console.log(
    `📊 Admin ${auth.username} retrieved platform stats: ${totalAlbums} albums, ${totalMedia} media`
  );

  return ResponseUtil.success(event, stats);
};

export const handler = LambdaHandlerUtil.withAdminAuth(handleGetStats);
