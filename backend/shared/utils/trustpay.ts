import { OrderEntity } from "@shared";
import { ParameterStoreService } from "./parameters";

export const getPaymentData = async (order: OrderEntity) => {
  const environment = (process.env["ENVIRONMENT"] || "dev") as "prod";
  const projectId = await ParameterStoreService.getTrustpayProjectId();
  const notificationUrls = {
    dev: "https://dev.api.pornspot.ai/trustpay/notification",
    stage: "https://stage.api.pornspot.ai/trustpay/notification",
    prod: "https://api.pornspot.ai/trustpay/notification",
  };
  const data = {
    PaymentMethod: "Card",
    MerchantIdentification: {
      ProjectId: projectId,
    },
    PaymentInformation: {
      Amount: {
        Amount: order.amount,
        Currency: order.currency,
      },
      References: {
        MerchantReference: order.orderId.toString(),
        ...(order.paymentRequestId && {
          OriginalPaymentRequestId: order.paymentRequestId.toString(),
        }),
      },
      CardTransaction: {
        PaymentType: "Purchase",
        Recurring: true,
      },
      CallbackUrls: {
        Notification: notificationUrls[environment],
      },
    },
  };

  return data;
};

export const getOauthToken = async (): Promise<string> => {
  // Retrieve credentials from Parameter Store or environment
  let projectId: string;
  let secretKey: string;

  try {
    [projectId, secretKey] = await Promise.all([
      ParameterStoreService.getTrustpayProjectId(),
      ParameterStoreService.getTrustpaySecretKey(),
    ]);
  } catch (err) {
    console.error(
      "[Trustpay] Trustpay credentials not configured or failed to load",
      err
    );
    throw new Error(
      "[Trustpay] Trustpay credentials are not set or could not be retrieved"
    );
  }

  if (!projectId || !secretKey) {
    console.error(
      "[Trustpay] Trustpay credentials missing (projectId/secretKey)"
    );
    throw new Error(
      "[Trustpay] Trustpay credentials are not set in the environment/parameter store"
    );
  }

  const url = "https://aapi.trustpay.eu/api/oauth2/token";
  // Build Basic auth header
  const auth = Buffer.from(`${projectId}:${secretKey}`).toString("base64");

  const headers = {
    Authorization: `Basic ${auth}`,
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  } as const;

  const body = new URLSearchParams({ grant_type: "client_credentials" });

  // Implement a 10s timeout using AbortController
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(
        `[Trustpay] OAuth request failed - status: ${
          response.status
        }, response: ${text.slice(0, 200)}`
      );
      throw new Error(
        `[Trustpay] OAuth request failed with status ${response.status}`
      );
    }

    let data: any;
    try {
      data = await response.json();
    } catch (jsonErr) {
      const text = await response.text().catch(() => "");
      console.error(
        `[Trustpay] Failed to parse OAuth JSON response: ${text.slice(0, 200)}`
      );
      throw new Error("[Trustpay] Invalid JSON response from OAuth API");
    }

    const accessToken = data?.access_token as string | undefined;
    if (!accessToken) {
      console.error(
        `[Trustpay] access_token not found in OAuth response. Available keys: ${
          data ? Object.keys(data) : []
        }`
      );
      throw new Error("[Trustpay] access_token not found in OAuth response");
    }

    return accessToken;
  } catch (error: any) {
    if (error?.name === "AbortError") {
      console.error("[Trustpay] OAuth request timed out after 10s");
      throw new Error("[Trustpay] OAuth request timed out");
    }
    console.error("[Trustpay] OAuth token retrieval failed:", error);
    throw error instanceof Error
      ? error
      : new Error("[Trustpay] OAuth token retrieval failed");
  } finally {
    clearTimeout(timeout);
  }
};
