import { ApiUtil } from "../api-util";

export const trustpayApi = {
  initiatePayment: async (item: string) => {
    const response = await ApiUtil.post<any>(`/trustpay/initiatePayment`, {
      item,
    });
    return ApiUtil.extractData(response); // Throws if not successful
  },
};
