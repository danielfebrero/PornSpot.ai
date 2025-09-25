export type FinbyPaymentStatus = "success" | "cancel" | "error";

export interface FinbyStatusRequest {
  reference: string;
  status: FinbyPaymentStatus;
}

export interface FinbyStatusResponse {
  completed?: boolean;
  message?: string;
  status?: "cancelled" | "failed";
  updated?: boolean;
}
