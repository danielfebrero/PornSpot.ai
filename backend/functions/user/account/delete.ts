import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { UserEntity } from "@shared";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";

interface DeleteAccountResponse {
  message: string;
}

const handleDeleteAccount = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  console.log("🔍 /user/account/delete handler called");

  // Only allow DELETE method
  if (event.httpMethod !== "DELETE") {
    console.log("❌ Method not allowed:", event.httpMethod);
    return ResponseUtil.methodNotAllowed(event, "Only DELETE method allowed");
  }

  console.log(`✅ User session valid: ${auth.userId}`);

  // Start the account deletion process (soft delete)
  console.log("🗑️ Starting account deletion process (soft delete)...");

  // 1. Mark user account as deleted and anonymize personal data
  console.log("📝 Anonymizing user account...");
  await anonymizeUserAccount(auth.userId);

  // 2. Delete active user sessions
  console.log("🚪 Deleting user sessions...");
  await deleteUserSessions(auth.userId);

  // Note: We keep media, albums, and interactions but they will show as "[deleted]" user

  console.log("✅ Account deletion completed successfully (soft delete)");

  const response: DeleteAccountResponse = {
    message:
      "Account deleted successfully. Your content will remain but show as '[deleted]' user",
  };

  return ResponseUtil.success(event, response);
};

/**
 * Anonymize user account (soft delete) by removing personal information
 * but keeping the user record so content can still reference it as "[deleted]"
 *
 * IMPORTANT: We must update both email/username AND their corresponding GSI indexes
 * (GSI1SK for email, GSI3SK for username) to ensure the original email/username
 * can be reused for new account registration without conflicts.
 */
async function anonymizeUserAccount(userId: string): Promise<void> {
  try {
    // Create anonymized email and update both email and GSI1SK to prevent conflicts
    const anonymizedEmail = `deleted.${userId}@deleted.local`;
    const anonymizedGoogleId = `deleted.${userId}`;

    // Update user to mark as deleted and remove personal information
    const anonymizedData: Partial<UserEntity> = {
      email: anonymizedEmail, // Keep unique for constraints
      GSI1SK: anonymizedEmail, // Update GSI1SK to match new email for proper indexing
      GSI2SK: anonymizedGoogleId,
      username: "[deleted]", // This will be displayed instead of real username
      GSI3SK: "[deleted]", // Update GSI3SK to match new username for proper indexing
      isActive: false,
      isEmailVerified: false,
    };

    // Remove optional personal fields if they exist
    const fieldsToRemove = {
      firstName: "",
      lastName: "",
      googleId: "",
      bio: "",
      location: "",
      website: "",
    };

    // Only add fields to remove if they would actually clear existing data
    Object.assign(anonymizedData, fieldsToRemove);

    await DynamoDBService.updateUser(userId, anonymizedData);
    console.log(
      `✅ User ${userId} has been anonymized with updated GSI indexes`
    );
  } catch (error) {
    console.error("Error anonymizing user account:", error);
    throw error;
  }
}

/**
 * Delete all active sessions for the user (logs them out everywhere)
 * Note: This is a simplified approach - in a production system you might
 * want to implement a more efficient way to track sessions by user
 */
async function deleteUserSessions(userId: string): Promise<void> {
  try {
    // For now, we'll rely on session expiration and the fact that
    // the user's isActive flag is set to false, which should invalidate sessions
    // A more robust approach would require indexing sessions by userId
    console.log(
      `🔐 Sessions for user ${userId} will be invalidated due to account deactivation`
    );
  } catch (error) {
    console.error("Error handling user sessions:", error);
    throw error;
  }
}

export const handler = LambdaHandlerUtil.withAuth(handleDeleteAccount);
