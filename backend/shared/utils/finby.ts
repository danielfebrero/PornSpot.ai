import { createHmac } from "crypto";
import { OrderEntity } from "@shared";
import { ParameterStoreService } from "./parameters";

const DEFAULT_FINBY_BASE_URL =
  process.env["FINBY_BASE_URL"] || "https://amapi.finby.eu/mapi5/Card/PayPopup";
const DEFAULT_PAYMENT_TYPE = 3;

const NOTIFICATION_SIGNATURE_FIELDS = [
  "AccountId",
  "Amount",
  "Currency",
  "Type",
  "ResultCode",
  "CounterAccount",
  "CounterAccountName",
  "OrderId",
  "PaymentId",
  "Reference",
  "RefuseReason",
] as const;

type NotificationSignatureField =
  (typeof NOTIFICATION_SIGNATURE_FIELDS)[number];

export type FinbyNotificationSignatureParams = Partial<
  Record<NotificationSignatureField, string | undefined>
>;

export interface FinbyGatewayOptions {
  /**
   * Explicit reference to use for the transaction. Defaults to orderId.
   */
  reference?: string;
  /**
   * Optional override for the payment type. Defaults to Parameter Store value or 3.
   */
  paymentType?: number;
  /**
   * Optional override for the Finby base URL.
   */
  baseUrl?: string;
  /**
   * Additional query parameters required by Finby (reserved for future use).
   */
  extraParams?: Record<string, string | number | boolean | undefined>;
}

const formatAmount = (value: string | number): string => {
  const numericValue =
    typeof value === "number" ? value : parseFloat(value.replace(",", "."));

  if (!Number.isFinite(numericValue)) {
    throw new Error(`[Finby] Invalid amount: ${value}`);
  }

  return numericValue.toFixed(2);
};

const generateSignature = (secretKey: string, payload: string): string =>
  createHmac("sha256", Buffer.from(secretKey, "utf8"))
    .update(Buffer.from(payload, "utf8"))
    .digest("hex")
    .toUpperCase();

const getPaymentType = async (override?: number): Promise<number> => {
  if (process.env["ENVIRONMENT"] !== "prod") {
    const testEnvOverride = 0;
    return testEnvOverride;
  }
  if (typeof override === "number" && !Number.isNaN(override)) {
    console.log(`[Finby] Using overridden payment type: ${override}`);
    return override;
  }

  console.log(`[Finby] Using default payment type: ${DEFAULT_PAYMENT_TYPE}`);
  return DEFAULT_PAYMENT_TYPE;
};

export const getFinbyGatewayUrl = async (
  order: OrderEntity,
  options: FinbyGatewayOptions = {}
): Promise<string> => {
  const [accountId, secretKey] = await Promise.all([
    ParameterStoreService.getFinbyAccountId(),
    ParameterStoreService.getFinbySecretKey(),
  ]);

  if (!accountId || !secretKey) {
    throw new Error("[Finby] Missing account credentials");
  }

  const baseUrl = options.baseUrl || DEFAULT_FINBY_BASE_URL;
  const paymentType = await getPaymentType(options.paymentType);
  // const notificationUrl = await ParameterStoreService.getFinbyNotificationUrl();
  const amount = formatAmount(order.amount);
  const currency = order.currency;
  const reference = options.reference || order.orderId;

  const signaturePayload = `${accountId}/${amount}/${currency}/${reference}/${paymentType}`;
  const signature = generateSignature(secretKey, signaturePayload);

  const params = new URLSearchParams({
    AccountId: accountId,
    Amount: amount,
    Currency: currency,
    Reference: reference,
    Signature: signature,
    PaymentType: paymentType.toString(),
    // NotificationUrl: notificationUrl,
  });

  if (options.extraParams) {
    for (const [key, value] of Object.entries(options.extraParams)) {
      if (value === undefined || value === null) continue;
      params.append(key, String(value));
    }
  }

  return `${baseUrl}?${params.toString()}`;
};

export const getFinbySignaturePayload = async (
  order: OrderEntity,
  options: FinbyGatewayOptions = {}
): Promise<{
  payload: string;
  signature: string;
  paymentType: number;
}> => {
  const [accountId, secretKey] = await Promise.all([
    ParameterStoreService.getFinbyAccountId(),
    ParameterStoreService.getFinbySecretKey(),
  ]);

  const paymentType = await getPaymentType(options.paymentType);
  const amount = formatAmount(order.amount);
  const currency = order.currency;
  const reference = options.reference || order.orderId;

  const payload = `${accountId}/${amount}/${currency}/${reference}/${paymentType}`;
  const signature = generateSignature(secretKey, payload);

  return { payload, signature, paymentType };
};

const buildNotificationSignaturePayload = (
  params: FinbyNotificationSignatureParams
): string => {
  const parts: string[] = [];

  for (const field of NOTIFICATION_SIGNATURE_FIELDS) {
    const value = params[field];
    if (value !== undefined && value !== null && value !== "") {
      parts.push(String(value));
    }
  }

  return parts.join("/");
};

export const generateFinbyNotificationSignature = (
  secretKey: string,
  params: FinbyNotificationSignatureParams
): string => {
  const payload = buildNotificationSignaturePayload(params);
  return generateSignature(secretKey, payload);
};

export const verifyFinbyNotificationSignature = (
  secretKey: string,
  params: FinbyNotificationSignatureParams,
  providedSignature: string
): boolean => {
  if (!providedSignature) {
    return false;
  }

  const calculated = generateFinbyNotificationSignature(secretKey, params);
  return calculated === providedSignature.toUpperCase();
};

export interface FinbyRecurringChargeOptions {
  paymentRequestId: string;
  amount?: string | number;
  currency?: string;
  reference?: string;
  paymentType?: number;
  baseUrl?: string;
  extraParams?: Record<string, string | number | boolean | undefined>;
  timeoutMs?: number;
}

export interface FinbyRecurringChargeResponse {
  status: number;
  resultCode?: string;
  acquirerResponseId?: string;
  rawBody: string;
}

const parseFinbyResponseBody = (body: string): any => {
  if (!body) {
    return null;
  }

  try {
    return JSON.parse(body);
  } catch (err) {
    try {
      const normalized = body.replace(/'/g, '"');
      return JSON.parse(normalized);
    } catch {
      return null;
    }
  }
};

export const chargeFinbyRecurringPayment = async (
  order: OrderEntity,
  options: FinbyRecurringChargeOptions
): Promise<FinbyRecurringChargeResponse> => {
  if (!options.paymentRequestId) {
    throw new Error(
      "[Finby] Missing payment request identifier for recurring charge"
    );
  }

  const [accountId, secretKey] = await Promise.all([
    ParameterStoreService.getFinbyAccountId(),
    ParameterStoreService.getFinbySecretKey(),
  ]);

  if (!accountId || !secretKey) {
    throw new Error("[Finby] Missing account credentials for recurring charge");
  }

  const amount = formatAmount(options.amount ?? order.amount);
  const currency = options.currency ?? order.currency;
  const reference = options.reference ?? order.orderId;
  const paymentType = options.paymentType ?? 4;
  const paymentRequestId = options.paymentRequestId;

  const basePayloadParts = [
    accountId,
    amount,
    currency,
    reference,
    paymentType.toString(),
  ];

  const signaturePayload = [...basePayloadParts, paymentRequestId].join("/");
  const signature = generateSignature(secretKey, signaturePayload);

  const params = new URLSearchParams({
    AccountId: accountId,
    Amount: amount,
    Currency: currency,
    Reference: reference,
    Signature: signature,
    PaymentType: paymentType.toString(),
    PaymentRequestId: paymentRequestId,
  });

  if (options.extraParams) {
    for (const [key, value] of Object.entries(options.extraParams)) {
      if (value === undefined || value === null) continue;
      params.append(key, String(value));
    }
  }

  const baseUrl = options.baseUrl || DEFAULT_FINBY_BASE_URL;
  const requestUrl = `${baseUrl}?${params.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 15_000
  );

  try {
    const response = await fetch(requestUrl, {
      method: "GET",
      signal: controller.signal,
    });

    const rawBody = await response.text();
    const parsed = parseFinbyResponseBody(rawBody);

    if (!response.ok) {
      throw new Error(
        `[Finby] Recurring charge request failed with status ${
          response.status
        }: ${rawBody.slice(0, 200)}`
      );
    }

    const resultCode = parsed?.ResultCode ?? parsed?.resultCode;
    const acquirerResponseId =
      parsed?.AcquirerResponseId ?? parsed?.acquirerResponseId;

    return {
      status: response.status,
      resultCode: resultCode != null ? String(resultCode) : undefined,
      acquirerResponseId: acquirerResponseId
        ? String(acquirerResponseId)
        : undefined,
      rawBody,
    };
  } catch (error) {
    if ((error as Error)?.name === "AbortError") {
      throw new Error("[Finby] Recurring charge request timed out");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
};
