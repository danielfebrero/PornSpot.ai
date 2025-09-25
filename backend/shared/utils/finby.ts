import { createHmac } from "crypto";
import { OrderEntity } from "@shared";
import { ParameterStoreService } from "./parameters";

const DEFAULT_FINBY_BASE_URL =
  process.env["FINBY_BASE_URL"] || "https://amapi.finby.eu/mapi5/Card/PayPopup";
const DEFAULT_PAYMENT_TYPE = 3;

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
  if (typeof override === "number" && !Number.isNaN(override)) {
    return override;
  }

  const configuredType = await ParameterStoreService.getFinbyPaymentType();
  if (configuredType) {
    return configuredType;
  }

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
