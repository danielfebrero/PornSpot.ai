import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { APIGatewayProxyEvent } from "aws-lambda";
import { handler } from "../../../../functions/finby/notification";

jest.mock("../../../../shared/utils/dynamodb");
jest.mock("../../../../shared/utils/parameters");
jest.mock("../../../../shared/utils/finby");
jest.mock("../../../../shared/utils/order-items");
jest.mock("../../../../shared/utils/response");

import { DynamoDBService } from "../../../../shared/utils/dynamodb";
import { ParameterStoreService } from "../../../../shared/utils/parameters";
import { verifyFinbyNotificationSignature } from "../../../../shared/utils/finby";
import { resolveOrderItem } from "../../../../shared/utils/order-items";
import { ResponseUtil } from "../../../../shared/utils/response";
import type { OrderEntity, UserEntity } from "../../../../shared/shared-types";

const mockDynamoDBService = DynamoDBService as jest.Mocked<
  typeof DynamoDBService
>;
const mockParameterStore = ParameterStoreService as jest.Mocked<
  typeof ParameterStoreService
>;
const mockVerifySignature = verifyFinbyNotificationSignature as jest.Mock;
const mockResolveOrderItem = resolveOrderItem as jest.Mock;
const mockResponseUtil = ResponseUtil as jest.Mocked<typeof ResponseUtil>;

describe("Finby notification handler", () => {
  const baseNow = new Date("2024-01-01T00:00:00.000Z");

  const createEvent = (
    params: Record<string, string>,
    method: string = "GET"
  ): APIGatewayProxyEvent =>
    ({
      httpMethod: method,
      queryStringParameters: params,
      headers: {},
    } as unknown as APIGatewayProxyEvent);

  const defaultOrder = {
    PK: "ORDER#order-123",
    SK: "METADATA",
    GSI1PK: "ORDERS_BY_USER#user-1",
    GSI1SK: "2023-12-31T00:00:00.000Z#order-123",
    GSI2PK: "ORDERS_BY_STATUS#initiated",
    GSI2SK: "2023-12-31T00:00:00.000Z#order-123",
    GSI3PK: "ORDER_BY_ITEM#video-credits-10",
    GSI3SK: "2023-12-31T00:00:00.000Z#order-123",
    EntityType: "Order" as const,
    orderId: "order-123",
    userId: "user-1",
    item: "video-credits-10",
    amount: "10.00",
    currency: "USD",
    status: "initiated",
    paymentProvider: "finby",
    createdAt: "2023-12-31T00:00:00.000Z",
    updatedAt: "2023-12-31T00:00:00.000Z",
  } satisfies OrderEntity;

  const defaultUser = {
    PK: "USER#user-1",
    SK: "METADATA",
    GSI1PK: "USER_EMAIL",
    GSI1SK: "user@example.com",
    GSI3PK: "USER_USERNAME",
    GSI3SK: "user",
    EntityType: "User" as const,
    userId: "user-1",
    email: "user@example.com",
    username: "user",
    provider: "email",
    createdAt: "2020-01-01T00:00:00.000Z",
    isActive: true,
    isEmailVerified: true,
    role: "user",
    plan: "free",
  } satisfies UserEntity;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(baseNow);

    mockParameterStore.getFinbyAccountId.mockResolvedValue("account-1");
    mockParameterStore.getFinbySecretKey.mockResolvedValue("secret-1");
    mockResponseUtil.noContent.mockReturnValue({
      statusCode: 204,
    } as any);
    mockResponseUtil.methodNotAllowed.mockReturnValue({
      statusCode: 405,
    } as any);
    mockResponseUtil.badRequest.mockReturnValue({
      statusCode: 400,
    } as any);
    mockResponseUtil.unauthorized.mockReturnValue({
      statusCode: 401,
    } as any);
    mockResponseUtil.notFound.mockReturnValue({
      statusCode: 404,
    } as any);
    mockResponseUtil.internalError.mockReturnValue({
      statusCode: 500,
    } as any);
    mockResponseUtil.success.mockReturnValue({
      statusCode: 200,
    } as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should handle OPTIONS requests", async () => {
    const event = createEvent({}, "OPTIONS");

    await handler(event);

    expect(mockResponseUtil.noContent).toHaveBeenCalledWith(event);
  });

  it("should reject non-GET methods", async () => {
    const event = createEvent({}, "POST");

    await handler(event);

    expect(mockResponseUtil.methodNotAllowed).toHaveBeenCalledWith(
      event,
      "Only GET method allowed"
    );
  });

  it("should validate required signature parameter", async () => {
    const event = createEvent({ Reference: "order-123" });

    await handler(event);

    expect(mockResponseUtil.badRequest).toHaveBeenCalledWith(
      event,
      "Missing signature parameter"
    );
  });

  it("should reject invalid signatures", async () => {
    const event = createEvent({
      Signature: "INVALID",
      Reference: "order-123",
      ResultCode: "0",
      AccountId: "account-1",
    });

    mockVerifySignature.mockReturnValue(false);

    await handler(event);

    expect(mockResponseUtil.unauthorized).toHaveBeenCalledWith(
      event,
      "Invalid signature"
    );
  });

  it("should return not found when order does not exist", async () => {
    const event = createEvent({
      Signature: "VALID",
      Reference: "order-404",
      ResultCode: "0",
      AccountId: "account-1",
    });

    mockVerifySignature.mockReturnValue(true);
    mockDynamoDBService.getOrder.mockResolvedValue(null);

    await handler(event);

    expect(mockDynamoDBService.getOrder).toHaveBeenCalledWith("order-404");
    expect(mockResponseUtil.notFound).toHaveBeenCalledWith(
      event,
      "Order not found"
    );
  });

  it("should skip processing when order already completed", async () => {
    const event = createEvent({
      Signature: "VALID",
      Reference: "order-123",
      ResultCode: "0",
      AccountId: "account-1",
    });

    mockVerifySignature.mockReturnValue(true);
    mockDynamoDBService.getOrder.mockResolvedValue({
      ...defaultOrder,
      status: "completed",
    });

    await handler(event);

    expect(mockDynamoDBService.updateOrder).not.toHaveBeenCalled();
    expect(mockResponseUtil.success).toHaveBeenCalledWith(
      event,
      expect.objectContaining({ message: "Order already processed" })
    );
  });

  it("should mark order as failed when result code is not zero", async () => {
    const event = createEvent({
      Signature: "VALID",
      Reference: "order-123",
      ResultCode: "12",
      AccountId: "account-1",
      PaymentRequestId: "req-1",
    });

    mockVerifySignature.mockReturnValue(true);
    mockDynamoDBService.getOrder.mockResolvedValue(defaultOrder);

    await handler(event);

    expect(mockDynamoDBService.updateOrder).toHaveBeenCalledWith(
      "order-123",
      expect.objectContaining({
        status: "failed",
        paymentRequestId: "req-1",
        GSI2PK: "ORDERS_BY_STATUS#failed",
        GSI2SK: expect.stringContaining("order-123"),
      })
    );
    expect(mockDynamoDBService.updateUser).not.toHaveBeenCalled();
    expect(mockResponseUtil.success).toHaveBeenCalledWith(
      event,
      expect.objectContaining({ status: "failed" })
    );
  });

  it("should process video credit orders", async () => {
    const event = createEvent({
      Signature: "VALID",
      Reference: "order-123",
      ResultCode: "0",
      AccountId: "account-1",
      PaymentRequestId: "req-1",
      PaymentId: "pay-1",
    });

    mockVerifySignature.mockReturnValue(true);
    mockDynamoDBService.getOrder.mockResolvedValue(defaultOrder);
    mockDynamoDBService.getUserById.mockResolvedValue({
      ...defaultUser,
      i2vCreditsSecondsPurchased: 120,
    });
    mockResolveOrderItem.mockReturnValue({
      id: "video-credits-10",
      metadata: {
        type: "video-credits",
        seconds: 20,
      },
    });

    await handler(event);

    expect(mockDynamoDBService.updateOrder).toHaveBeenCalledWith(
      "order-123",
      expect.objectContaining({
        status: "completed",
        paymentRequestId: "req-1",
        completedAt: baseNow.toISOString(),
      })
    );
    expect(mockDynamoDBService.updateUser).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ i2vCreditsSecondsPurchased: 140 })
    );
    expect(mockResponseUtil.success).toHaveBeenCalledWith(
      event,
      expect.objectContaining({ type: "video-credits" })
    );
  });

  it("should activate subscription plans", async () => {
    const event = createEvent({
      Signature: "VALID",
      Reference: "order-999",
      ResultCode: "0",
      AccountId: "account-1",
      PaymentRequestId: "req-9",
    });

    const subscriptionOrder: OrderEntity = {
      ...defaultOrder,
      orderId: "order-999",
      item: "starter-monthly",
      GSI3PK: "ORDER_BY_ITEM#starter-monthly",
      userId: "user-42",
    };

    mockVerifySignature.mockReturnValue(true);
    mockDynamoDBService.getOrder.mockResolvedValue(subscriptionOrder);
    mockDynamoDBService.getUserById.mockResolvedValue({
      ...defaultUser,
      userId: "user-42",
    });
    mockResolveOrderItem.mockReturnValue({
      id: "starter-monthly",
      renewalFrequency: "monthly",
    });

    await handler(event);

    expect(mockDynamoDBService.updateOrder).toHaveBeenCalled();
    expect(mockDynamoDBService.updateUser).toHaveBeenCalledWith(
      "user-42",
      expect.objectContaining({
        subscriptionId: "order-999",
        subscriptionStatus: "active",
        plan: "starter",
        GSI4PK: "USER_PLAN#starter",
      })
    );
    expect(mockResponseUtil.success).toHaveBeenCalledWith(
      event,
      expect.objectContaining({ type: "subscription", plan: "starter" })
    );
  });
});
