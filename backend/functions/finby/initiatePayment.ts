import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { orderItems } from "@shared/utils/order-items";
import { ResponseUtil } from "@shared/utils/response";
import { v4 } from "uuid";
import { DynamoDBService } from "@shared/utils/dynamodb";
import type { OrderEntity } from "@shared/shared-types";
import { getFinbyGatewayUrl } from "@shared/utils/finby";

const handleInitiatePayment = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  const { userId } = auth;
  const request: { item: string } = LambdaHandlerUtil.parseJsonBody(event);
  const orderItem = orderItems.find((item) => item.id === request.item);

  if (!orderItem) {
    return ResponseUtil.badRequest(event, "Invalid item");
  }

  if (!userId) {
    return ResponseUtil.unauthorized(event, "User not authenticated");
  }

  const orderId = v4().replace(/-/g, "");
  const now = new Date().toISOString();
  const status: OrderEntity["status"] = "initiated";

  const order: OrderEntity = {
    PK: `ORDER#${orderId}`,
    SK: "METADATA",
    GSI1PK: `ORDERS_BY_USER#${userId}`,
    GSI1SK: `${now}#${orderId}`,
    GSI2PK: `ORDERS_BY_STATUS#${status}`,
    GSI2SK: `${now}#${orderId}`,
    GSI3PK: `ORDER_BY_ITEM#${orderItem.id}`,
    GSI3SK: `${now}#${orderId}`,
    EntityType: "Order",
    orderId,
    userId,
    item: orderItem.id,
    amount: orderItem.amount.toFixed(2),
    currency: orderItem.currency,
    status,
    paymentProvider: "finby",
    createdAt: now,
    updatedAt: now,
  };

  await DynamoDBService.insertOrder(order);

  try {
    const gatewayUrl = await getFinbyGatewayUrl(order, { paymentType: 3 });

    return ResponseUtil.success(event, {
      orderId,
      status,
      gatewayUrl,
    });
  } catch (error) {
    console.error("[Finby] Failed to generate gateway URL", error);
    return ResponseUtil.error(event, "Failed to initiate payment", 500);
  }
};

export const handler = LambdaHandlerUtil.withAuth(handleInitiatePayment, {
  requireBody: true,
});
