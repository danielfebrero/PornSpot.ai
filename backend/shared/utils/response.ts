import { APIGatewayProxyResult, APIGatewayProxyEvent } from "aws-lambda";
import { ApiResponse } from "@shared/shared-types";

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://pornspot.ai",
  "https://www.pornspot.ai",
  "https://staging.pornspot.ai",
  /^https:\/\/pornspot-ai-frontend-.*-pornspot\.vercel\.app$/, // Vercel Preview
  "https://pornspot-ai-frontend.vercel.app", // Vercel Production
];

const getCorsHeaders = (
  event: APIGatewayProxyEvent
): { [key: string]: string | boolean } => {
  const origin = event.headers["origin"] || event.headers["Origin"];

  const baseHeaders = {
    "Access-Control-Allow-Headers":
      "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,Accept,Origin,Referer,DNT,sec-ch-ua,sec-ch-ua-mobile,sec-ch-ua-platform,Sec-Fetch-Dest,Sec-Fetch-Mode,Sec-Fetch-Site,Cookie",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  };

  if (origin) {
    const isAllowed = allowedOrigins.some((allowed) => {
      if (typeof allowed === "string") {
        return allowed === origin;
      }
      return allowed.test(origin);
    });

    if (isAllowed) {
      return {
        ...baseHeaders,
        "Access-Control-Allow-Origin": origin,
      };
    }
  }

  return baseHeaders;
};

export class ResponseUtil {
  static success<T>(
    event: APIGatewayProxyEvent,
    data: T,
    statusCode: number = 200
  ): APIGatewayProxyResult {
    const response: ApiResponse<T> = {
      success: true,
      data,
    };

    return {
      statusCode,
      headers: {
        "Content-Type": "application/json",
        ...getCorsHeaders(event),
      },
      body: JSON.stringify(response),
    };
  }

  static error(
    event: APIGatewayProxyEvent,
    message: string,
    statusCode: number = 400
  ): APIGatewayProxyResult {
    const response: ApiResponse = {
      success: false,
      error: message,
    };

    return {
      statusCode,
      headers: {
        "Content-Type": "application/json",
        ...getCorsHeaders(event),
      },
      body: JSON.stringify(response),
    };
  }

  static notFound(
    event: APIGatewayProxyEvent,
    message: string = "Resource not found"
  ): APIGatewayProxyResult {
    return this.error(event, message, 404);
  }

  static badRequest(
    event: APIGatewayProxyEvent,
    message: string = "Bad request"
  ): APIGatewayProxyResult {
    return this.error(event, message, 400);
  }

  static unauthorized(
    event: APIGatewayProxyEvent,
    message: string = "Unauthorized"
  ): APIGatewayProxyResult {
    return this.error(event, message, 401);
  }

  static forbidden(
    event: APIGatewayProxyEvent,
    message: string = "Forbidden"
  ): APIGatewayProxyResult {
    return this.error(event, message, 403);
  }

  static methodNotAllowed(
    event: APIGatewayProxyEvent,
    message: string = "Method not allowed"
  ): APIGatewayProxyResult {
    return this.error(event, message, 405);
  }

  static internalError(
    event: APIGatewayProxyEvent,
    message: string = "Internal server error"
  ): APIGatewayProxyResult {
    return this.error(event, message, 500);
  }

  static created<T>(
    event: APIGatewayProxyEvent,
    data: T
  ): APIGatewayProxyResult {
    return this.success(event, data, 201);
  }

  static noContent(event: APIGatewayProxyEvent): APIGatewayProxyResult {
    return {
      statusCode: 204,
      headers: getCorsHeaders(event),
      body: "",
    };
  }

  static redirect(
    event: APIGatewayProxyEvent,
    location: string
  ): APIGatewayProxyResult {
    return {
      statusCode: 302,
      headers: {
        ...getCorsHeaders(event),
        Location: location,
      },
      body: "",
    };
  }
}
