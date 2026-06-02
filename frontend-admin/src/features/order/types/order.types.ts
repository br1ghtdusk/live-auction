export interface Order {
  orderId: number;
  auctionId: number;
  merchantId: number;
  winnerId: number;
  finalPrice: string;
  finalPriceFen: number;
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED';
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  auctionName: string;
  auctionImage: string | null;
}

export interface GetOrdersResponse {
  success: boolean;
  data: Order[];
  total: number;
  error?: string;
}