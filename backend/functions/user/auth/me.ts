import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { PlanUtil } from "@shared/utils/plan";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";

const handleGetMe = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  const { userId } = auth;
  
  console.log("🔍 /user/me handler called");
  console.log("✅ Authenticated user:", userId);

  console.log("🔍 Getting user from database...");
  const userEntity = await DynamoDBService.getUserById(userId);
  console.log(
    "👤 User entity:",
    userEntity ? `Found (${userEntity.email})` : "Not found"
  );

  if (!userEntity) {
    console.log("❌ User not found in database");
    return ResponseUtil.notFound(event, "User not found");
  }

  // Return enhanced user info with plan information
  const user = await PlanUtil.enhanceUser(userEntity);
  console.log("✅ Returning enhanced user data:", user);

  return ResponseUtil.success(event, { user });
};

export const handler = LambdaHandlerUtil.withAuth(handleGetMe);
