import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { orderItems } from "@shared/utils/order-items";
import { ResponseUtil } from "@shared/utils/response";
import { v4 } from "uuid";
import { DynamoDBService } from "@shared/utils/dynamodb";
import type { OrderEntity } from "@shared/shared-types";
import { getOauthToken, getPaymentData } from "@shared/utils/trustpay";

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
    // Keys
    PK: `ORDER#${orderId}`,
    SK: "METADATA",
    GSI1PK: `ORDERS_BY_USER#${userId}`,
    GSI1SK: `${now}#${orderId}`,
    GSI2PK: `ORDERS_BY_STATUS#${status}`,
    GSI2SK: `${now}#${orderId}`,
    GSI3PK: `ORDER_BY_ITEM#${orderItem.id}`,
    GSI3SK: `${now}#${orderId}`,

    // Entity typing
    EntityType: "Order",

    // Domain fields
    orderId,
    userId,
    item: orderItem.id,
    amount: orderItem.amount.toFixed(2),
    currency: orderItem.currency,
    status,
    paymentProvider: "trustpay",
    createdAt: now,
    updatedAt: now,
  };

  await DynamoDBService.insertOrder(order);

  const paymentData = await getPaymentData(order);
  // Send payment request to TrustPay and return GatewayUrl for redirection
  const oauthToken = await getOauthToken();

  console.log({ paymentData });

  // Endpoint based on TrustPay Acceptance API
  const paymentUrl = "https://aapi.trustpay.eu/api/Payments/Payment";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(paymentUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${oauthToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(paymentData),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(
        `[Trustpay] Payment request failed - status: ${
          response.status
        }, response: ${text.slice(0, 200)}`
      );
      return ResponseUtil.error(event, "Failed to initiate payment", 502);
    }

    let data: any;
    try {
      data = await response.json();
    } catch (e) {
      const text = await response.text().catch(() => "");
      console.error(
        `[Trustpay] Failed to parse payment response JSON: ${text.slice(
          0,
          200
        )}`
      );
      return ResponseUtil.error(event, "Invalid payment response", 502);
    }

    console.log({ data });

    const gatewayUrl: string | undefined = data?.GatewayUrl;

    return ResponseUtil.success(event, {
      orderId,
      status,
      gatewayUrl: gatewayUrl ?? null,
    });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      console.error("[Trustpay] Payment request timed out after 10s");
      return ResponseUtil.error(event, "Payment request timed out", 504);
    }
    console.error("[Trustpay] Payment request failed:", error);
    return ResponseUtil.error(event, "Failed to initiate payment", 500);
  } finally {
    clearTimeout(timeout);
  }
};

export const handler = LambdaHandlerUtil.withAuth(handleInitiatePayment, {
  requireBody: true,
});
