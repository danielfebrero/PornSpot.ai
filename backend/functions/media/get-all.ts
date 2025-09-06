import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";

/**
 * @fileoverview All Public Media Retrieval Handler
 * @description Retrieves all public media items from DynamoDB for static site generation (SSG) or indexing.
 * @auth Public endpoint via LambdaHandlerUtil.withoutAuth.
 * @notes
 * - Calls getAllPublicMedia to fetch all isPublic=true media.
 * - Used for pre-rendering media pages.
 * - Logs the media array.
 * - No pagination; assumes manageable size.
 */
const handleGetAllMedia = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // Get all public media directly from DynamoDB
  const allMedia = await DynamoDBService.getAllPublicMedia();

  return ResponseUtil.success(event, allMedia);
};

export const handler = LambdaHandlerUtil.withoutAuth(handleGetAllMedia);
