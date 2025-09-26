import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ParameterStoreService } from "@shared/utils/parameters";
// import { verifyFinbyNotificationSignature } from "@shared/utils/finby";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";
import { resolveOrderItem } from "@shared/utils/order-items";
import type { OrderEntity, UserEntity } from "@shared/shared-types";
// import type { FinbyNotificationSignatureParams } from "@shared/utils/finby";
import type { UserPlan } from "@shared/shared-types/permissions";

const SUCCESS_RESULT_CODE = "0";
const AUTHORIZED_RESULT_CODE = "3";
const MAX_PLAN_END_DATE = "9999-12-31T00:00:00.000Z";

const isNonEmpty = (value: string | undefined | null): value is string =>
  typeof value === "string" && value.length > 0;

const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

const addYears = (date: Date, years: number): Date => {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
};

const resolvePlanFromItem = (itemId: string): UserPlan | null => {
  const [planCandidate] = itemId.split("-");

  if (!planCandidate) {
    return null;
  }

  if (
    planCandidate === "starter" ||
    planCandidate === "unlimited" ||
    planCandidate === "pro"
  ) {
    return planCandidate;
  }

  return null;
};

// const buildSignatureParams = (
//   query: Record<string, string | undefined>
// ): FinbyNotificationSignatureParams => ({
//   AccountId: query["AccountId"],
//   Amount: query["Amount"],
//   Currency: query["Currency"],
//   Type: query["Type"] ?? query["PaymentType"],
//   ResultCode: query["ResultCode"],
//   CounterAccount: query["CounterAccount"],
//   CounterAccountName: query["CounterAccountName"],
//   OrderId: query["OrderId"],
//   PaymentId: query["PaymentId"],
//   Reference: query["Reference"],
//   RefuseReason: query["RefuseReason"],
// });

const updateUserForSubscription = async (
  order: OrderEntity,
  plan: UserPlan,
  renewalFrequency: "monthly" | "yearly" | undefined,
  nowISO: string
): Promise<void> => {
  let planEndDate: string | undefined;

  if (renewalFrequency === "monthly") {
    planEndDate = addMonths(new Date(nowISO), 1).toISOString();
  } else if (renewalFrequency === "yearly") {
    planEndDate = addYears(new Date(nowISO), 1).toISOString();
  }

  const indexDate = planEndDate ?? MAX_PLAN_END_DATE;

  const userUpdates: Partial<UserEntity> = {
    subscriptionId: order.orderId,
    subscriptionStatus: "active",
    planStartDate: nowISO,
    planEndDate,
    plan,
    GSI4PK: `USER_PLAN#${plan}`,
    GSI4SK: `${indexDate}#${order.userId}`,
  };

  if (plan === "pro") {
    userUpdates.i2vCreditsSecondsFromPlan = 100;
  }

  await DynamoDBService.updateUser(order.userId, userUpdates);
};

const updateUserForVideoCredits = async (
  order: OrderEntity,
  user: UserEntity,
  seconds: number
): Promise<void> => {
  const current = user.i2vCreditsSecondsPurchased ?? 0;
  const nextValue = current + seconds;

  await DynamoDBService.updateUser(order.userId, {
    i2vCreditsSecondsPurchased: nextValue,
  });
};

const handleFinbyNotification = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === "OPTIONS") {
    return ResponseUtil.noContent(event);
  }

  if (event.httpMethod !== "GET") {
    return ResponseUtil.methodNotAllowed(event, "Only GET method allowed");
  }

  const queryParams = (event.queryStringParameters ?? {}) as Record<
    string,
    string | undefined
  >;

  console.log("[Finby] Notification received", queryParams);

  // if (!isNonEmpty(queryParams["Signature"])) {
  //   return ResponseUtil.badRequest(event, "Missing signature parameter");
  // }

  if (!isNonEmpty(queryParams["Reference"])) {
    console.log("[Finby] Missing reference parameter");
    return ResponseUtil.badRequest(event, "Missing reference parameter");
  }

  if (!isNonEmpty(queryParams["ResultCode"])) {
    console.log("[Finby] Missing result code parameter");
    return ResponseUtil.badRequest(event, "Missing result code parameter");
  }

  if (!isNonEmpty(queryParams["AccountId"])) {
    console.log("[Finby] Missing account identifier");
    return ResponseUtil.badRequest(event, "Missing account identifier");
  }

  const configuredAccountId = await ParameterStoreService.getFinbyAccountId();

  if (queryParams["AccountId"] !== configuredAccountId) {
    console.log("[Finby] Account identifier mismatch", {
      received: queryParams["AccountId"],
      expected: configuredAccountId,
    });
    return ResponseUtil.unauthorized(event, "Account identifier mismatch");
  }

  // const signatureParams = buildSignatureParams(queryParams);
  // const providedSignature = queryParams["Signature"]!.trim().toUpperCase();
  // const signatureValid = verifyFinbyNotificationSignature(
  //   secretKey,
  //   signatureParams,
  //   providedSignature
  // );

  // if (!signatureValid) {
  //   console.warn("[Finby] Invalid signature", {
  //     signatureParams,
  //     providedSignature,
  //   });
  //   return ResponseUtil.unauthorized(event, "Invalid signature");
  // }

  const orderId = queryParams["Reference"]!;
  const order = await DynamoDBService.getOrder(orderId);

  if (!order) {
    console.warn("[Finby] Order not found", { orderId });
    return ResponseUtil.notFound(event, "Order not found");
  }

  console.log("[Finby] Processing order", { order });

  if (order.status !== "initiated") {
    return ResponseUtil.success(event, {
      message: "Order already processed",
      orderId,
    });
  }

  const nowISO = new Date().toISOString();
  const isSuccess =
    queryParams["ResultCode"] === SUCCESS_RESULT_CODE ||
    queryParams["ResultCode"] === AUTHORIZED_RESULT_CODE;
  const nextStatus: OrderEntity["status"] = isSuccess ? "completed" : "failed";

  const orderUpdates: Partial<OrderEntity> = {
    status: nextStatus,
    updatedAt: nowISO,
    GSI2PK: `ORDERS_BY_STATUS#${nextStatus}`,
    GSI2SK: `${nowISO}#${orderId}`,
  };

  if (isNonEmpty(queryParams["PaymentRequestId"])) {
    orderUpdates.paymentRequestId = queryParams["PaymentRequestId"];
  }

  if (isSuccess) {
    orderUpdates.completedAt = nowISO;
  }

  if (isNonEmpty(queryParams["PaymentId"])) {
    orderUpdates.metadata = {
      ...(order.metadata ?? {}),
      paymentId: queryParams["PaymentId"],
    };
  }

  console.log("[Finby] Updating order", { orderId, orderUpdates });

  await DynamoDBService.updateOrder(orderId, orderUpdates);

  if (!isSuccess) {
    return ResponseUtil.success(event, {
      status: "failed",
      orderId,
    });
  }

  const user = await DynamoDBService.getUserById(order.userId);

  if (!user) {
    console.error("[Finby] User not found for order", {
      orderId,
      userId: order.userId,
    });
    return ResponseUtil.internalError(event, "User not found for order");
  }

  const orderItem = resolveOrderItem(order.item);

  if (!orderItem) {
    console.error("[Finby] Unable to resolve order item", {
      orderId,
      item: order.item,
    });
    return ResponseUtil.internalError(event, "Unknown order item");
  }

  if (orderItem.metadata?.["type"] === "video-credits") {
    const seconds = Number(orderItem.metadata?.["seconds"]);

    if (!Number.isFinite(seconds) || seconds <= 0) {
      console.error("[Finby] Invalid video credit amount", {
        orderId,
        item: order.item,
        metadata: orderItem.metadata,
      });
      return ResponseUtil.internalError(event, "Invalid video credit amount");
    }

    console.log("[Finby] Adding video credits to user", { orderId, seconds });
    await updateUserForVideoCredits(order, user, seconds);

    return ResponseUtil.success(event, {
      status: "completed",
      type: "video-credits",
      orderId,
      seconds,
    });
  }

  const plan = resolvePlanFromItem(orderItem.id);

  if (!plan) {
    console.error("[Finby] Unable to resolve plan from order item", {
      orderId,
      item: order.item,
    });
    return ResponseUtil.internalError(event, "Unable to resolve plan");
  }

  await updateUserForSubscription(
    order,
    plan,
    orderItem.renewalFrequency,
    nowISO
  );

  return ResponseUtil.success(event, {
    status: "completed",
    type: "subscription",
    orderId,
    plan,
    renewalFrequency: orderItem.renewalFrequency ?? null,
  });
};

export const handler = LambdaHandlerUtil.withoutAuth(handleFinbyNotification);
