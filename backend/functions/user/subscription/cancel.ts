import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { CancelSubscriptionResponse } from "@shared/shared-types/user";

const handleCancelSubscription = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  console.log("🔍 /user/subscription/cancel handler called");

  // Only allow POST method
  if (event.httpMethod !== "POST") {
    console.log("❌ Method not allowed:", event.httpMethod);
    return ResponseUtil.methodNotAllowed(event, "Only POST method allowed");
  }

  console.log(`✅ User session valid: ${auth.userId}`);

  // Get full user entity to access subscription information
  console.log("📋 Fetching user subscription details...");
  const userEntity = await DynamoDBService.getUserById(auth.userId);

  if (!userEntity) {
    console.log("❌ User entity not found");
    return ResponseUtil.unauthorized(event, "User not found");
  }

  // Check if user has an active subscription
  if (!userEntity.plan || userEntity.plan === "free") {
    console.log("❌ User has no active subscription");
    return ResponseUtil.badRequest(event, "No active subscription to cancel");
  }

  if (userEntity.subscriptionStatus === "canceled") {
    console.log("❌ Subscription already canceled");
    return ResponseUtil.badRequest(event, "Subscription is already canceled");
  }

  // TODO: In a real implementation, you would:
  // 1. Call Stripe API to cancel the subscription
  // 2. Handle webhook to update the database
  // For now, we'll simulate by updating the status

  console.log("💳 Canceling subscription...");

  // Update subscription status to canceled
  // Keep the plan active until the end of the billing period
  const updates = {
    subscriptionStatus: "canceled" as const,
    // Keep plan and planEndDate unchanged - user retains access until end of billing period
  };

  await DynamoDBService.updateUser(auth.userId, updates);

  console.log(`✅ User ${auth.userId} subscription canceled successfully`);

  const response: CancelSubscriptionResponse = {
    message:
      "Subscription canceled successfully. You will retain access to your current plan until the end of your billing period.",
  };

  return ResponseUtil.success(event, response);
};

export const handler = LambdaHandlerUtil.withAuth(handleCancelSubscription);
