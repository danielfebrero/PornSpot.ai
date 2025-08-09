import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { UserUtil } from "@shared/utils/user";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";
import { ValidationUtil } from "@shared/utils/validation";
import {
  UsernameAvailabilityRequest,
  UsernameAvailabilityResponse,
} from "@shared";

const handleCheckUsername = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Support both GET and POST methods for flexibility
  let username: string;

  if (event.httpMethod === "GET") {
    // GET method: username in query parameter
    username = event.queryStringParameters?.["username"] || "";
  } else if (event.httpMethod === "POST") {
    // POST method: username in request body
    const request: UsernameAvailabilityRequest = JSON.parse(event.body!);
    username = request.username || "";
  } else {
    return ResponseUtil.error(event, "Method not allowed", 405);
  }

  // Validate username is provided
  if (!username || username.trim().length === 0) {
    const response: UsernameAvailabilityResponse = {
      success: false,
      available: false,
      error: "Username is required",
    };
    return ResponseUtil.success(event, response);
  }

  // Validate username format using shared validation
  try {
    const validatedUsername = ValidationUtil.validateUsername(username);
    
    // Check if username is available
    const existingUser = await DynamoDBService.getUserByUsername(validatedUsername);
    const isAvailable = !existingUser;

    const response: UsernameAvailabilityResponse = {
      success: true,
      available: isAvailable,
      message: isAvailable
        ? "Username is available"
        : "Username is already taken",
    };

    return ResponseUtil.success(event, response);
  } catch (error) {
    // Username validation failed
    const response: UsernameAvailabilityResponse = {
      success: false,
      available: false,
      message: error instanceof Error ? error.message : "Username validation failed",
    };
    return ResponseUtil.success(event, response);
  }
};

export const handler = LambdaHandlerUtil.withoutAuth(handleCheckUsername);
