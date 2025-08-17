import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";

/**
 * Handler to get all public media
 * This function retrieves all public media items from DynamoDB
 * It is used for SSG purposes to pre-render media pages
 *
 * @param event - API Gateway event
 * @returns APIGatewayProxyResult with all public media
 */
const handleGetAllMedia = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // Get all public media directly from DynamoDB
  const allMedia = await DynamoDBService.getAllPublicMedia();
  console.log({ allMedia });

  return ResponseUtil.success(event, allMedia);
};

export const handler = LambdaHandlerUtil.withoutAuth(handleGetAllMedia);
