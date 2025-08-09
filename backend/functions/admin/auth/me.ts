import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { PlanUtil } from "@shared/utils/plan";
import { UserAuthMiddleware } from "@shared/auth/user-middleware";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";

const handleAdminMe = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("🔍 /admin/me handler called");
  console.log(
    "📋 Request context:",
    JSON.stringify(event.requestContext, null, 2)
  );

  // Get user ID from authorizer context (role-based authorizer)
  let userId = event.requestContext.authorizer?.["userId"] as string;
  const userRole = event.requestContext.authorizer?.["role"] as string;

  console.log("👤 UserId from authorizer:", userId);
  console.log("🎭 Role from authorizer:", userRole);

  // Fallback for local development or when authorizer context is missing
  if (!userId) {
    console.log(
      "⚠️ No userId from authorizer, falling back to session validation"
    );
    const validation = await UserAuthMiddleware.validateSession(event);

    if (!validation.isValid || !validation.user) {
      console.log("❌ Session validation failed");
      return ResponseUtil.unauthorized(event, "No user session found");
    }

    userId = validation.user.userId;
    console.log("✅ Got userId from session validation:", userId);
  }

  const userEntity = await DynamoDBService.getUserById(userId);
  if (!userEntity) {
    return ResponseUtil.notFound(event, "User not found");
  }

  // Get user role (admin or moderator)
  const role =
    userRole || (await PlanUtil.getUserRole(userId, userEntity.email));

  // Verify user has admin privileges
  if (role !== "admin" && role !== "moderator") {
    console.log("❌ User does not have admin privileges:", role);
    return ResponseUtil.forbidden(
      event,
      "Access denied: insufficient privileges"
    );
  }

  // Return user info formatted as admin (without sensitive data)
  const admin = {
    adminId: userEntity.userId, // Use userId as adminId for compatibility
    username: userEntity.username || userEntity.email,
    email: userEntity.email,
    role: role,
    createdAt: userEntity.createdAt,
    isActive: userEntity.isActive,
  };

  console.log(`👤 Admin ${admin.username} (${role}) retrieved profile`);

  return ResponseUtil.success(event, { admin });
};

export const handler = LambdaHandlerUtil.withoutAuth(handleAdminMe);
