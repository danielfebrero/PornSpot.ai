import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ResponseUtil } from "@shared/utils/response";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { ParameterStoreService } from "@shared/utils/parameters";
// import { verifyFinbyNotificationSignature } from "@shared/utils/finby";
import { LambdaHandlerUtil } from "@shared/utils/lambda-handler";
import { EmailService } from "@shared/utils/email";
import { resolveOrderItem } from "@shared/utils/order-items";
import type { OrderEntity, UserEntity } from "@shared/shared-types";
// import type { FinbyNotificationSignatureParams } from "@shared/utils/finby";
import type { UserPlan } from "@shared/shared-types/permissions";
import type { ResolvedOrderItem } from "@shared/utils/order-items";

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

type PaymentNotificationContext = {
  order: OrderEntity;
  user: UserEntity;
  orderItem: ResolvedOrderItem;
  paymentId?: string;
  paymentRequestId?: string;
  paymentType?: string;
  resultCode?: string;
  reportedAmount?: string;
  reportedCurrency?: string;
  subscriptionPlan?: UserPlan;
  renewalFrequency?: "monthly" | "yearly";
  videoCreditsSeconds?: number;
};

const notifyAdminOfSuccessfulPayment = async (
  context: PaymentNotificationContext
): Promise<void> => {
  try {
    const recipient =
      await ParameterStoreService.getFinbyNotificationRecipient();

    const buyerName = context.user.username || context.user.email;
    const buyerEmail = context.user.email;
    const userId = context.user.userId;
    const subject = `[Finby] Payment completed - ${context.orderItem.name}`;
    const orderAmount = `${context.order.amount} ${context.order.currency}`;
    const catalogAmount = `${context.orderItem.amount.toFixed(2)} ${
      context.orderItem.currency
    }`;
    const createdAt = context.order.createdAt;
    const completedAt = context.order.completedAt;
    const rows: string[] = [
      `<tr><td style="padding:4px 8px;font-weight:600;">Buyer</td><td style="padding:4px 8px;">${buyerName}</td></tr>`,
      `<tr><td style="padding:4px 8px;font-weight:600;">Buyer email</td><td style="padding:4px 8px;">${buyerEmail}</td></tr>`,
      `<tr><td style="padding:4px 8px;font-weight:600;">User ID</td><td style="padding:4px 8px;">${userId}</td></tr>`,
      `<tr><td style="padding:4px 8px;font-weight:600;">Item</td><td style="padding:4px 8px;">${context.orderItem.name}</td></tr>`,
      `<tr><td style="padding:4px 8px;font-weight:600;">Order ID</td><td style="padding:4px 8px;">${context.order.orderId}</td></tr>`,
      `<tr><td style="padding:4px 8px;font-weight:600;">Order amount</td><td style="padding:4px 8px;">${orderAmount}</td></tr>`,
      `<tr><td style="padding:4px 8px;font-weight:600;">Catalog amount</td><td style="padding:4px 8px;">${catalogAmount}</td></tr>`,
      `<tr><td style="padding:4px 8px;font-weight:600;">Order status</td><td style="padding:4px 8px;">${context.order.status}</td></tr>`,
      `<tr><td style="padding:4px 8px;font-weight:600;">Created at</td><td style="padding:4px 8px;">${createdAt}</td></tr>`,
    ];

    if (completedAt) {
      rows.push(
        `<tr><td style="padding:4px 8px;font-weight:600;">Completed at</td><td style="padding:4px 8px;">${completedAt}</td></tr>`
      );
    }

    if (context.subscriptionPlan) {
      rows.push(
        `<tr><td style="padding:4px 8px;font-weight:600;">Plan</td><td style="padding:4px 8px;">${context.subscriptionPlan}</td></tr>`
      );
    }

    if (context.renewalFrequency) {
      rows.push(
        `<tr><td style="padding:4px 8px;font-weight:600;">Renewal frequency</td><td style="padding:4px 8px;">${context.renewalFrequency}</td></tr>`
      );
    }

    if (typeof context.videoCreditsSeconds === "number") {
      rows.push(
        `<tr><td style="padding:4px 8px;font-weight:600;">Video credits</td><td style="padding:4px 8px;">${context.videoCreditsSeconds} seconds</td></tr>`
      );
    }

    if (context.reportedAmount && context.reportedCurrency) {
      rows.push(
        `<tr><td style="padding:4px 8px;font-weight:600;">Reported amount</td><td style="padding:4px 8px;">${context.reportedAmount} ${context.reportedCurrency}</td></tr>`
      );
    }

    if (context.paymentId) {
      rows.push(
        `<tr><td style="padding:4px 8px;font-weight:600;">Payment ID</td><td style="padding:4px 8px;">${context.paymentId}</td></tr>`
      );
    }

    if (context.paymentRequestId) {
      rows.push(
        `<tr><td style="padding:4px 8px;font-weight:600;">Payment request ID</td><td style="padding:4px 8px;">${context.paymentRequestId}</td></tr>`
      );
    }

    if (context.paymentType) {
      rows.push(
        `<tr><td style="padding:4px 8px;font-weight:600;">Payment type</td><td style="padding:4px 8px;">${context.paymentType}</td></tr>`
      );
    }

    if (context.resultCode) {
      rows.push(
        `<tr><td style="padding:4px 8px;font-weight:600;">Result code</td><td style="padding:4px 8px;">${context.resultCode}</td></tr>`
      );
    }

    const htmlBody = `
      <h2 style="margin-bottom:16px;">Finby payment completed</h2>
      <p style="margin-bottom:16px;">A payment has been processed successfully.</p>
      <table style="border-collapse:collapse;background:#0f172a;color:#e2e8f0;border-radius:12px;overflow:hidden;">
        <tbody>
          ${rows.join("\n")}
        </tbody>
      </table>
    `;

    const textLines = [
      "Finby payment completed.",
      `Buyer: ${buyerName}`,
      `Buyer email: ${buyerEmail}`,
      `User ID: ${userId}`,
      `Item: ${context.orderItem.name}`,
      `Order ID: ${context.order.orderId}`,
      `Order amount: ${orderAmount}`,
      `Catalog amount: ${catalogAmount}`,
      `Order status: ${context.order.status}`,
      `Created at: ${createdAt}`,
    ];

    if (completedAt) {
      textLines.push(`Completed at: ${completedAt}`);
    }

    if (context.subscriptionPlan) {
      textLines.push(`Plan: ${context.subscriptionPlan}`);
    }

    if (context.renewalFrequency) {
      textLines.push(`Renewal frequency: ${context.renewalFrequency}`);
    }

    if (typeof context.videoCreditsSeconds === "number") {
      textLines.push(`Video credits: ${context.videoCreditsSeconds} seconds`);
    }

    if (context.reportedAmount && context.reportedCurrency) {
      textLines.push(
        `Reported amount: ${context.reportedAmount} ${context.reportedCurrency}`
      );
    }

    if (context.paymentId) {
      textLines.push(`Payment ID: ${context.paymentId}`);
    }

    if (context.paymentRequestId) {
      textLines.push(`Payment request ID: ${context.paymentRequestId}`);
    }

    if (context.paymentType) {
      textLines.push(`Payment type: ${context.paymentType}`);
    }

    if (context.resultCode) {
      textLines.push(`Result code: ${context.resultCode}`);
    }

    const textBody = textLines.join("\n");

    await EmailService.sendEmail({
      to: recipient,
      template: {
        subject,
        htmlBody,
        textBody,
      },
    });
  } catch (error) {
    console.error("[Finby] Failed to send payment notification email", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
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
    imagesGeneratedThisMonth: 0,
    imagesGeneratedToday: 0,
    i2vCreditsSecondsFromPlan:
      plan === "pro" ? 100 : plan === "unlimited" ? 20 : 0,
  };

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

  const paymentId = queryParams["PaymentId"]?.trim();
  const paymentRequestId = queryParams["PaymentRequestId"]?.trim();
  const paymentType = (
    queryParams["Type"] ?? queryParams["PaymentType"]
  )?.trim();
  const reportedAmount = queryParams["Amount"]?.trim();
  const reportedCurrency = queryParams["Currency"]?.trim();
  const resultCode = queryParams["ResultCode"];

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

  if (paymentRequestId) {
    orderUpdates.paymentRequestId = paymentRequestId;
  }

  if (isSuccess) {
    orderUpdates.completedAt = nowISO;
  }

  if (paymentId) {
    orderUpdates.metadata = {
      ...(order.metadata ?? {}),
      paymentId,
    };
  }

  console.log("[Finby] Updating order", { orderId, orderUpdates });

  await DynamoDBService.updateOrder(orderId, orderUpdates);

  const updatedOrder: OrderEntity = { ...order, ...orderUpdates };

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
    await updateUserForVideoCredits(updatedOrder, user, seconds);

    await notifyAdminOfSuccessfulPayment({
      order: updatedOrder,
      user,
      orderItem,
      paymentId,
      paymentRequestId,
      paymentType,
      resultCode,
      reportedAmount,
      reportedCurrency,
      videoCreditsSeconds: seconds,
    });

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
    updatedOrder,
    plan,
    orderItem.renewalFrequency,
    nowISO
  );

  await notifyAdminOfSuccessfulPayment({
    order: updatedOrder,
    user,
    orderItem,
    paymentId,
    paymentRequestId,
    paymentType,
    resultCode,
    reportedAmount,
    reportedCurrency,
    subscriptionPlan: plan,
    renewalFrequency: orderItem.renewalFrequency,
  });

  return ResponseUtil.success(event, {
    status: "completed",
    type: "subscription",
    orderId,
    plan,
    renewalFrequency: orderItem.renewalFrequency ?? null,
  });
};

export const handler = LambdaHandlerUtil.withoutAuth(handleFinbyNotification);
