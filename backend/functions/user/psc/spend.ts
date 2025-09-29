/**
 * @fileoverview User PSC Spend API
 * @description Allows authenticated users to spend PSC to purchase or extend subscription plans.
 * @notes
 * - Supports starter, unlimited, pro, and lifetime (pro with no expiry) plans.
 * - Validates PSC amount, available balance, and creates a PSC purchase transaction.
 * - Updates user plan metadata (planStartDate, planEndDate, GSI4 keys) and PSC balance.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { v4 as uuidv4 } from "uuid";
import { ResponseUtil } from "@shared/utils/response";
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { DynamoDBService } from "@shared/utils/dynamodb";
import { PSCTransactionService } from "@shared/utils/psc-transactions";
import type {
  PSCSpendRequest,
  PSCSpendResponse,
  TransactionEntity,
} from "@shared/shared-types";
import type { UserEntity, UserPlan } from "@shared/shared-types";

const MAX_PLAN_END_DATE = "9999-12-31T00:00:00.000Z";

const PLAN_CONFIG: Record<
  "starter" | "unlimited" | "pro" | "lifetime",
  {
    plan: UserPlan;
    cost: number;
    durationMonths?: number;
    isLifetime?: boolean;
  }
> = {
  starter: {
    plan: "starter",
    cost: 9,
    durationMonths: 1,
  },
  unlimited: {
    plan: "unlimited",
    cost: 18,
    durationMonths: 1,
  },
  pro: {
    plan: "pro",
    cost: 27,
    durationMonths: 1,
  },
  lifetime: {
    plan: "pro",
    cost: 1000,
    isLifetime: true,
  },
};

type SpendPlanKey = keyof typeof PLAN_CONFIG;

const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date.getTime());
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const handlePSCSpend = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  console.log("💸 /user/psc/spend handler invoked", {
    method: event.httpMethod,
    userId: auth.userId,
  });

  if (event.httpMethod !== "POST") {
    return ResponseUtil.methodNotAllowed(event, "Only POST method allowed");
  }

  let payload: PSCSpendRequest;

  try {
    payload = LambdaHandlerUtil.parseJsonBody<PSCSpendRequest>(event);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid request payload";
    console.warn("Invalid PSC spend payload", { message });
    return ResponseUtil.badRequest(event, message);
  }

  const planKey = payload.plan as SpendPlanKey;
  const planConfig = PLAN_CONFIG[planKey];

  if (!planConfig) {
    console.warn("Attempted PSC spend with unknown plan", {
      plan: payload.plan,
    });
    return ResponseUtil.badRequest(event, "Invalid plan selected");
  }

  const requestedAmount = payload.pscAmount;

  if (!isFiniteNumber(requestedAmount) || requestedAmount <= 0) {
    return ResponseUtil.badRequest(event, "Invalid PSC amount");
  }

  if (Math.abs(requestedAmount - planConfig.cost) > 1e-6) {
    return ResponseUtil.badRequest(
      event,
      `Selected plan requires ${planConfig.cost} PSC`
    );
  }

  const userEntity = await DynamoDBService.getUserById(auth.userId);

  if (!userEntity) {
    console.error("PSC spend attempted by missing user", {
      userId: auth.userId,
    });
    return ResponseUtil.unauthorized(event, "User not found");
  }

  if (
    userEntity.plan === "pro" &&
    !userEntity.planEndDate &&
    planKey === "lifetime"
  ) {
    return ResponseUtil.badRequest(event, "Lifetime plan already active");
  }

  const currentBalance = userEntity.pscBalance || 0;

  if (currentBalance < planConfig.cost) {
    return ResponseUtil.badRequest(event, "Insufficient PSC balance");
  }

  const now = new Date();

  let nextPlanStart = now;
  let nextPlanEnd: string | null = null;

  if (planConfig.isLifetime) {
    nextPlanEnd = null;
  } else {
    const existingEndDate = userEntity.planEndDate
      ? new Date(userEntity.planEndDate)
      : null;
    const hasActiveSamePlan =
      userEntity.plan === planConfig.plan &&
      existingEndDate !== null &&
      existingEndDate.getTime() > now.getTime();

    if (hasActiveSamePlan) {
      nextPlanStart = existingEndDate!;
    }

    const durationMonths = planConfig.durationMonths ?? 1;
    nextPlanEnd = addMonths(nextPlanStart, durationMonths).toISOString();
  }

  const transactionId = uuidv4();
  const transactionTimestamp = new Date().toISOString();

  const transaction: TransactionEntity = {
    PK: `TRANSACTION#${transactionId}`,
    SK: "METADATA",
    GSI1PK: "TRANSACTION_BY_DATE",
    GSI1SK: `${transactionTimestamp}#${transactionId}`,
    GSI2PK: "TRANSACTION_BY_FROM_USER",
    GSI2SK: `${auth.userId}#${transactionTimestamp}#${transactionId}`,
    GSI3PK: "TRANSACTION_BY_TO_USER",
    GSI3SK: `TREASURE#${transactionTimestamp}#${transactionId}`,
    GSI4PK: "TRANSACTION_BY_TYPE",
    GSI4SK: `purchase#${transactionTimestamp}#${transactionId}`,
    GSI5PK: "TRANSACTION_BY_STATUS",
    GSI5SK: `completed#${transactionTimestamp}#${transactionId}`,
    EntityType: "Transaction",
    transactionId,
    transactionType: "purchase",
    status: "completed",
    amount: planConfig.cost,
    fromUserId: auth.userId,
    toUserId: "TREASURE",
    description: `PSC plan purchase (${planKey})`,
    metadata: {
      plan: planConfig.plan,
      lifetime: Boolean(planConfig.isLifetime),
      cost: planConfig.cost,
      previousPlan: userEntity.plan,
      ...(payload.metadata ?? {}),
    },
    createdAt: transactionTimestamp,
    completedAt: transactionTimestamp,
  };

  const transactionResult = await PSCTransactionService.executeTransaction(
    transaction
  );

  if (!transactionResult.success) {
    const message =
      transactionResult.error || "Failed to record PSC transaction";
    console.error("PSC spend transaction failed", {
      userId: auth.userId,
      plan: planKey,
      error: message,
    });
    return ResponseUtil.error(event, message);
  }

  const indexDate = nextPlanEnd ?? MAX_PLAN_END_DATE;
  const planVideoCreditsSeconds =
    planConfig.plan === "pro" ? 100 : planConfig.plan === "unlimited" ? 20 : 0;

  const userUpdates: Partial<UserEntity> & Record<string, any> = {
    plan: planConfig.plan,
    planStartDate: nextPlanStart.toISOString(),
    GSI4PK: `USER_PLAN#${planConfig.plan}`,
    GSI4SK: `${indexDate}#${auth.userId}`,
    subscriptionStatus: "active",
    imagesGeneratedThisMonth: 0,
    imagesGeneratedToday: 0,
    i2vCreditsSecondsFromPlan: planVideoCreditsSeconds,
  };

  if (planConfig.isLifetime) {
    userUpdates.planEndDate = null as any;
  } else {
    userUpdates.planEndDate = nextPlanEnd!;
  }

  await DynamoDBService.updateUser(auth.userId, userUpdates);

  const balanceResult = await PSCTransactionService.getUserBalance(auth.userId);

  const response: PSCSpendResponse = {
    transaction: transactionResult.transaction,
    ...(balanceResult.success && balanceResult.balance
      ? { balance: balanceResult.balance }
      : {}),
  };

  console.log("✅ PSC spend completed", {
    userId: auth.userId,
    plan: planKey,
    newPlanStart: userUpdates.planStartDate,
    newPlanEnd: nextPlanEnd,
  });

  return ResponseUtil.success(event, response);
};

export const handler = LambdaHandlerUtil.withAuth(handlePSCSpend, {
  requireBody: true,
});
