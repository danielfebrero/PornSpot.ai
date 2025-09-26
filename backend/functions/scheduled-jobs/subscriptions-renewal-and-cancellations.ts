/**
 * @fileoverview Scheduled job to renew subscriptions and clean up cancelled plans
 * @schedule Daily at 00:01 UTC via EventBridge
 * @notes
 * - Queries users whose planEndDate matches the current UTC day using GSI4
 * - Users with cancelled subscriptions are downgraded to the free plan
 * - Active subscriptions trigger a Finby recurring charge (PaymentType=4)
 * - Extends plan windows on successful charge and records a recurring order entry
 */
import type { EventBridgeEvent } from "aws-lambda";
import { v4 as uuidv4 } from "uuid";
import {
  DynamoDBService,
  UserPlanRenewalCandidate,
} from "@shared/utils/dynamodb";
import { resolveOrderItem } from "@shared/utils/order-items";
import {
  chargeFinbyRecurringPayment,
  type FinbyRecurringChargeResponse,
} from "@shared/utils/finby";
import type { OrderEntity } from "@shared/shared-types";

const MAX_PLAN_END_DATE = "9999-12-31T00:00:00.000Z";
const SUCCESS_RESULT_CODES = new Set(["0", "3"]);

interface RenewalJobStats {
  processedUsers: number;
  cancellationsProcessed: number;
  chargesAttempted: number;
  chargesSucceeded: number;
  chargesFailed: number;
  skipped: number;
}

const normalizeStatus = (status?: string | null): string | null => {
  if (!status) return null;
  const normalized = status.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

const addMonths = (date: Date, months: number): Date => {
  const cloned = new Date(date.getTime());
  cloned.setUTCMonth(cloned.getUTCMonth() + months);
  return cloned;
};

const addYears = (date: Date, years: number): Date => {
  const cloned = new Date(date.getTime());
  cloned.setUTCFullYear(cloned.getUTCFullYear() + years);
  return cloned;
};

const resetUserToFree = async (
  user: UserPlanRenewalCandidate,
  reason: string
): Promise<void> => {
  console.log(
    `[Subscriptions] Resetting user ${user.userId} to free plan (${reason})`
  );

  await DynamoDBService.updateUser(user.userId, {
    plan: "free",
    GSI4PK: "USER_PLAN#free",
    GSI4SK: `${MAX_PLAN_END_DATE}#${user.userId}`,
    planStartDate: null,
    planEndDate: null,
    subscriptionStatus: null,
    subscriptionId: null,
  } as any);

  try {
    await DynamoDBService.deleteGenerationSettings(user.userId);
  } catch (error) {
    console.error(
      `[Subscriptions] Failed to delete generation settings for user ${user.userId}:`,
      error
    );
  }
};

const markSubscriptionExpired = async (
  user: UserPlanRenewalCandidate,
  reason: string
): Promise<void> => {
  console.warn(
    `[Subscriptions] Marking subscription expired for user ${user.userId}: ${reason}`
  );

  await DynamoDBService.updateUser(user.userId, {
    plan: "free",
    GSI4PK: "USER_PLAN#free",
    GSI4SK: `${MAX_PLAN_END_DATE}#${user.userId}`,
    planStartDate: null,
    planEndDate: null,
    subscriptionStatus: "expired",
    subscriptionId: null,
  } as any);

  try {
    await DynamoDBService.deleteGenerationSettings(user.userId);
  } catch (error) {
    console.error(
      `[Subscriptions] Failed to delete generation settings for user ${user.userId}:`,
      error
    );
  }
};

const createRecurringOrder = async (
  user: UserPlanRenewalCandidate,
  baseOrder: OrderEntity,
  renewalFrequency?: "monthly" | "yearly"
): Promise<OrderEntity> => {
  const nowISO = new Date().toISOString();
  const orderId = uuidv4().replace(/-/g, "");

  const order: OrderEntity = {
    PK: `ORDER#${orderId}`,
    SK: "METADATA",
    GSI1PK: `ORDERS_BY_USER#${user.userId}`,
    GSI1SK: `${nowISO}#${orderId}`,
    GSI2PK: "ORDERS_BY_STATUS#initiated",
    GSI2SK: `${nowISO}#${orderId}`,
    GSI3PK: `ORDER_BY_ITEM#${baseOrder.item}`,
    GSI3SK: `${nowISO}#${orderId}`,
    EntityType: "Order",
    orderId,
    userId: user.userId,
    item: baseOrder.item,
    amount: baseOrder.amount,
    currency: baseOrder.currency,
    status: "initiated",
    paymentProvider: "finby",
    createdAt: nowISO,
    updatedAt: nowISO,
    paymentRequestId: baseOrder.paymentRequestId,
    metadata: {
      ...(baseOrder.metadata ?? {}),
      parentOrderId: baseOrder.orderId,
      recurring: true,
      cycleStartedAt: user.planEndDate,
      ...(renewalFrequency ? { renewalFrequency } : {}),
    },
  };

  await DynamoDBService.insertOrder(order);
  return order;
};

const computeNextPlanWindow = (
  user: UserPlanRenewalCandidate,
  renewalFrequency: "monthly" | "yearly"
): { startISO: string; endISO: string } => {
  const currentEnd = user.planEndDate ? new Date(user.planEndDate) : new Date();

  const safeCurrentEnd = Number.isNaN(currentEnd.getTime())
    ? new Date()
    : currentEnd;

  const startISO = user.planEndDate ?? safeCurrentEnd.toISOString();
  const nextEndDate =
    renewalFrequency === "yearly"
      ? addYears(safeCurrentEnd, 1)
      : addMonths(safeCurrentEnd, 1);

  return { startISO, endISO: nextEndDate.toISOString() };
};

const updateOrderMetadata = async (
  orderId: string,
  updates: Partial<OrderEntity>
): Promise<void> => {
  await DynamoDBService.updateOrder(orderId, updates);
};

const handleSuccessfulCharge = async (
  user: UserPlanRenewalCandidate,
  newOrder: OrderEntity,
  response: FinbyRecurringChargeResponse,
  renewalFrequency: "monthly" | "yearly"
): Promise<void> => {
  const nowISO = new Date().toISOString();
  const metadataUpdates: Record<string, any> = {
    ...(newOrder.metadata ?? {}),
    resultCode: response.resultCode,
  };

  if (response.acquirerResponseId) {
    metadataUpdates["acquirerResponseId"] = response.acquirerResponseId;
  }

  metadataUpdates["rawResponse"] = response.rawBody;

  await updateOrderMetadata(newOrder.orderId, {
    status: "completed",
    completedAt: nowISO,
    updatedAt: nowISO,
    GSI2PK: "ORDERS_BY_STATUS#completed",
    GSI2SK: `${nowISO}#${newOrder.orderId}`,
    metadata: metadataUpdates,
  });

  const { startISO, endISO } = computeNextPlanWindow(user, renewalFrequency);

  await DynamoDBService.updateUser(user.userId, {
    plan: user.plan,
    planStartDate: startISO,
    planEndDate: endISO,
    subscriptionStatus: "active",
    subscriptionId: newOrder.orderId,
    GSI4PK: `USER_PLAN#${user.plan}`,
    GSI4SK: `${endISO}#${user.userId}`,
  });
};

const handleFailedCharge = async (
  user: UserPlanRenewalCandidate,
  newOrder: OrderEntity,
  reason: string,
  resultCode?: string,
  rawResponse?: string
): Promise<void> => {
  const nowISO = new Date().toISOString();
  const metadataUpdates: Record<string, any> = {
    ...(newOrder.metadata ?? {}),
    failureReason: reason,
  };

  if (resultCode) {
    metadataUpdates["resultCode"] = resultCode;
  }

  if (rawResponse) {
    metadataUpdates["rawResponse"] = rawResponse;
  }

  await updateOrderMetadata(newOrder.orderId, {
    status: "failed",
    updatedAt: nowISO,
    GSI2PK: "ORDERS_BY_STATUS#failed",
    GSI2SK: `${nowISO}#${newOrder.orderId}`,
    metadata: metadataUpdates,
  });

  await markSubscriptionExpired(user, reason);
};

const processActiveSubscription = async (
  user: UserPlanRenewalCandidate,
  stats: RenewalJobStats
): Promise<void> => {
  if (!user.subscriptionId) {
    console.warn(
      `[Subscriptions] User ${user.userId} missing subscription id for renewal`
    );
    stats.chargesFailed += 1;
    await markSubscriptionExpired(user, "missing subscriptionId");
    return;
  }

  const baseOrder = await DynamoDBService.getOrder(user.subscriptionId);

  if (!baseOrder) {
    console.warn(
      `[Subscriptions] Base order ${user.subscriptionId} not found for user ${user.userId}`
    );
    stats.chargesFailed += 1;
    await markSubscriptionExpired(user, "missing original order");
    return;
  }

  if (!baseOrder.paymentRequestId) {
    console.warn(
      `[Subscriptions] Base order ${baseOrder.orderId} missing paymentRequestId`
    );
    stats.chargesFailed += 1;
    await markSubscriptionExpired(user, "missing paymentRequestId");
    return;
  }

  const orderItem = resolveOrderItem(baseOrder.item);
  const renewalFrequency =
    orderItem?.renewalFrequency ||
    (baseOrder.metadata?.["renewalFrequency"] as
      | "monthly"
      | "yearly"
      | undefined) ||
    (baseOrder.item.endsWith("-yearly") ? "yearly" : "monthly");

  let newOrder: OrderEntity;

  try {
    newOrder = await createRecurringOrder(user, baseOrder, renewalFrequency);
  } catch (error) {
    console.error(
      `[Subscriptions] Failed to create recurring order for user ${user.userId}:`,
      error
    );
    stats.chargesFailed += 1;
    await markSubscriptionExpired(user, "failed to create recurring order");
    return;
  }

  stats.chargesAttempted += 1;

  try {
    const response = await chargeFinbyRecurringPayment(newOrder, {
      paymentRequestId: baseOrder.paymentRequestId,
      amount: baseOrder.amount,
      currency: baseOrder.currency,
      reference: newOrder.orderId,
      paymentType: 4,
    });

    const resultCode = response.resultCode ?? "";

    if (SUCCESS_RESULT_CODES.has(resultCode)) {
      await handleSuccessfulCharge(user, newOrder, response, renewalFrequency);
      stats.chargesSucceeded += 1;
      console.log(
        `[Subscriptions] Successfully processed renewal for user ${user.userId} (plan: ${user.plan})`
      );
      return;
    }

    console.warn(
      `[Subscriptions] Finby recurring charge returned non-success code ${resultCode} for user ${user.userId}`
    );
    stats.chargesFailed += 1;
    await handleFailedCharge(
      user,
      newOrder,
      `Finby result code ${resultCode || "unknown"}`,
      resultCode || undefined,
      response.rawBody
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Finby error";
    console.error(
      `[Subscriptions] Recurring charge failed for user ${user.userId}:`,
      error
    );
    stats.chargesFailed += 1;
    await handleFailedCharge(user, newOrder, message);
  }
};

export async function handler(
  event: EventBridgeEvent<"Scheduled Event", any>
): Promise<RenewalJobStats> {
  console.log("[Subscriptions] Renewal and cancellation job started", {
    source: event.source,
    detailType: event["detail-type"],
    time: event.time,
  });

  const runDate = event.time ? new Date(event.time) : new Date();
  const targetISO = runDate.toISOString();

  let candidates: UserPlanRenewalCandidate[] = [];

  try {
    candidates = await DynamoDBService.getUsersWithPlanEndingOnDate(targetISO);
  } catch (error) {
    console.error(
      "[Subscriptions] Failed to query users with plan ending today:",
      error
    );
    throw error;
  }

  const stats: RenewalJobStats = {
    processedUsers: candidates.length,
    cancellationsProcessed: 0,
    chargesAttempted: 0,
    chargesSucceeded: 0,
    chargesFailed: 0,
    skipped: 0,
  };

  if (candidates.length === 0) {
    console.log("[Subscriptions] No users require renewal processing today");
    return stats;
  }

  console.log(
    `[Subscriptions] Processing ${candidates.length} user(s) for renewals on ${
      runDate.toISOString().split("T")[0]
    }`
  );

  for (const candidate of candidates) {
    const status = normalizeStatus(candidate.subscriptionStatus);

    if (!status || status === "canceled" || status === "cancelled") {
      await resetUserToFree(
        candidate,
        status ? `status=${status}` : "no active subscription"
      );
      stats.cancellationsProcessed += 1;
      continue;
    }

    if (status === "active") {
      await processActiveSubscription(candidate, stats);
      continue;
    }

    console.log(
      `[Subscriptions] Skipping user ${candidate.userId} with subscription status ${status}`
    );
    stats.skipped += 1;
  }

  console.log("[Subscriptions] Renewal and cancellation job completed", stats);
  return stats;
}
