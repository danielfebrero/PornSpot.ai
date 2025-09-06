/**
 * @fileoverview Admin Logout Handler
 * @description Invalidates the current admin session by deleting it from DynamoDB and clearing the session cookie.
 * @event APIGatewayProxyEvent
 * @returns APIGatewayProxyResult - Success message, sets Set-Cookie to clear session.
 * @notes
 * - Extracts sessionId from cookie header.
 * - Deletes user session even if expired.
 * - Uses createClearSessionCookie to expire the cookie immediately.
 * - No auth required (public endpoint for logout).
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ResponseUtil } from "@shared/utils/response";
import { AuthMiddleware } from "@shared/auth/admin-middleware";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";

const handleAdminLogout = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // Extract session from cookie and delete it, even if expired
  const cookieHeader = event.headers["Cookie"] || event.headers["cookie"] || "";
  const sessionId = AuthMiddleware.extractSessionFromCookies(cookieHeader);

  if (sessionId) {
    // Delete the user session from database (admins now use user sessions)
    await DynamoDBService.deleteUserSession(sessionId);
    console.log(`🔓 Admin logout for session: ${sessionId}`);
  }

  // Create clear session cookie
  const clearCookie = AuthMiddleware.createClearSessionCookie();

  const successResponse = ResponseUtil.success(event, {
    message: "Logged out successfully",
  });

  successResponse.headers = {
    ...successResponse.headers,
    "Set-Cookie": clearCookie,
  };

  return successResponse;
};

export const handler = LambdaHandlerUtil.withoutAuth(handleAdminLogout);
