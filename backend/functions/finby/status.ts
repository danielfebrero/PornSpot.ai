import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { ResponseUtil } from "@shared/utils/response";
import { DynamoDBService } from "@shared/utils/dynamodb";
import type { OrderEntity } from "@shared/shared-types";

interface FinbyStatusRequest {
  status?: string;
  reference?: string;
}

type OrderStatus = OrderEntity["status"];

const toLowerCaseSafe = (value?: string): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

const persistOrderStatusUpdate = async (
  order: OrderEntity,
  nextStatus: OrderStatus
): Promise<void> => {
  const nowISO = new Date().toISOString();

  await DynamoDBService.updateOrder(order.orderId, {
    status: nextStatus,
    updatedAt: nowISO,
    GSI2PK: `ORDERS_BY_STATUS#${nextStatus}`,
    GSI2SK: `${nowISO}#${order.orderId}`,
  });
};

const updateInitiatedOrderStatus = async (
  userId: string,
  reference: string,
  nextStatus: OrderStatus
): Promise<boolean> => {
  const referencedOrder = await DynamoDBService.getOrder(reference);

  if (
    referencedOrder &&
    referencedOrder.userId === userId &&
    referencedOrder.status === "initiated"
  ) {
    await persistOrderStatusUpdate(referencedOrder, nextStatus);
    return true;
  }

  const initiatedOrder = await DynamoDBService.findLatestOrderByStatusForUser(
    userId,
    "initiated"
  );

  if (!initiatedOrder) {
    return false;
  }

  await persistOrderStatusUpdate(initiatedOrder, nextStatus);
  return true;
};

const handleFinbyStatus = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod !== "POST") {
    return ResponseUtil.methodNotAllowed(event, "Only POST method allowed");
  }

  let body: FinbyStatusRequest;

  try {
    body = LambdaHandlerUtil.parseJsonBody<FinbyStatusRequest>(event);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid request payload";
    return ResponseUtil.badRequest(event, message);
  }

  const status = toLowerCaseSafe(body.status);
  const reference = body.reference?.trim();

  if (!status || !reference) {
    return ResponseUtil.badRequest(
      event,
      "Both status and reference are required"
    );
  }

  if (!auth.userId) {
    return ResponseUtil.unauthorized(event, "User not authenticated");
  }

  const userEntity = await DynamoDBService.getUserById(auth.userId);

  if (!userEntity) {
    return ResponseUtil.unauthorized(event, "User not found");
  }

  if (status === "success") {
    const completed = userEntity.subscriptionId === reference;
    return ResponseUtil.success(event, { completed });
  }

  if (status === "cancel" || status === "error") {
    const nextStatus: OrderStatus =
      status === "cancel" ? "cancelled" : "failed";
    const shouldUpdateOrder = userEntity.subscriptionId !== reference;

    let updated = false;

    if (shouldUpdateOrder) {
      updated = await updateInitiatedOrderStatus(
        auth.userId,
        reference,
        nextStatus
      );
    }

    return ResponseUtil.success(event, {
      status: nextStatus,
      updated,
    });
  }

  return ResponseUtil.badRequest(event, "Unsupported status value");
};

export const handler = LambdaHandlerUtil.withAuth(handleFinbyStatus, {
  requireBody: true,
});
