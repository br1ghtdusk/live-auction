import request from '../../../utils/request';
import type { Order } from '../types/order.types';

export interface GetOrdersResponse {
  success: boolean;
  data: Order[];
  total: number;
  error?: string;
}

export async function getMerchantOrders(merchantId: number): Promise<GetOrdersResponse> {
  const response = await request.get(`/merchant/orders?merchantId=${merchantId}`);
  return response.data;
}