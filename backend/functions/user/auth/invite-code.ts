import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";

// Valid invitation codes for private beta
const VALID_INVITATION_CODES = ["REDDIT420", "DISCORD69", "FRIENDS123"];

interface InvitationCodeRequest {
  code: string;
}

interface InvitationCodeResponse {
  valid: boolean;
  message?: string;
}

const handleInviteCode = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Only accept POST method
    if (event.httpMethod !== "POST") {
      return ResponseUtil.error(event, "Method not allowed", 405);
    }

    // Parse request body
    const request: InvitationCodeRequest = JSON.parse(event.body || "{}");
    const { code } = request;

    // Validate invitation code is provided
    if (!code || typeof code !== "string" || code.trim().length === 0) {
      const response: InvitationCodeResponse = {
        valid: false,
        message: "Invitation code is required",
      };
      return ResponseUtil.success(event, response);
    }

    // Normalize the code (uppercase, trimmed)
    const normalizedCode = code.trim().toUpperCase();

    // Check if the code is valid
    const isValid = VALID_INVITATION_CODES.includes(normalizedCode);

    const response: InvitationCodeResponse = {
      valid: isValid,
      message: isValid
        ? "Invitation code is valid"
        : "Invalid invitation code. Please check your code and try again.",
    };

    return ResponseUtil.success(event, response);
  } catch (error) {
    console.error("Error validating invitation code:", error);
    return ResponseUtil.error(event, "Internal server error", 500);
  }
};

// Export the handler with proper middleware
export const handler = LambdaHandlerUtil.withoutAuth(handleInviteCode);
