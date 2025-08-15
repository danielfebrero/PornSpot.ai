/*
File objective: Generate JWT token containing encrypted userId for WebSocket authentication
Auth: Requires user authentication via UserAuthorizer
Special notes:
- Generates JWT token with 1-hour expiration
- Uses SSM stored JWT secret for signing
- Returns token for use in WebSocket connection query parameters
*/
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { JWTService } from "@shared/utils/jwt";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";

const handleGenerateJWTToken = async (
  event: APIGatewayProxyEvent,
  auth: { userId: string }
): Promise<APIGatewayProxyResult> => {
  try {
    console.log("🔑 Generating JWT token for user:", auth.userId);

    // Generate JWT token with 1-hour expiration
    const jwtToken = await JWTService.generateToken(auth.userId, '1h');

    console.log("✅ JWT token generated successfully for user:", auth.userId);

    return ResponseUtil.success(event, {
      success: true,
      token: jwtToken,
      expiresIn: '1h',
      message: 'JWT token generated successfully'
    });
  } catch (error) {
    console.error("❌ JWT token generation error:", error);
    return ResponseUtil.internalError(
      event,
      error instanceof Error ? error.message : "Failed to generate JWT token"
    );
  }
};

export const handler = LambdaHandlerUtil.withAuth(handleGenerateJWTToken);