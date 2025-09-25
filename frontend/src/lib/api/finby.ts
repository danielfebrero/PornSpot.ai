import { FinbyStatusRequest, FinbyStatusResponse } from "@/types";
import { ApiUtil } from "../api-util";

export const finbyApi = {
  initiatePayment: async (item: string) => {
    const response = await ApiUtil.post<any>(`/finby/initiatePayment`, {
      item,
    });
    return ApiUtil.extractData(response); // Throws if not successful
  },
  status: async (payload: FinbyStatusRequest) => {
    const response = await ApiUtil.post<FinbyStatusResponse>(
      `/finby/status`,
      payload
    );
    return ApiUtil.extractData(response);
  },
};
