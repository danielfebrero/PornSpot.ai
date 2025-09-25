import { ApiUtil } from "../api-util";

export const finbyApi = {
  initiatePayment: async (item: string) => {
    const response = await ApiUtil.post<any>(`/finby/initiatePayment`, {
      item,
    });
    return ApiUtil.extractData(response); // Throws if not successful
  },
};
