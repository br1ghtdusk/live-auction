import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

export interface RoomStateResponse {
  success: boolean;
  code: number;
  data: {
    id: number;
    roomName: string;
    merchantId: number;
    status: string;
    currentAuction?: any;
  };
}

export interface BidHistoryResponse {
  success: boolean;
  code: number;
  data: Array<{
    id: number;
    userId: number;
    amount: number;
    time: string;
  }>;
}

export interface LeaderboardResponse {
  success: boolean;
  code: number;
  data: Array<{
    userId: number;
    username: string;
    avatar: string;
    maxBidAmount: number;  // 最高出价（分）
    bidCount: number;      // 出价次数
  }>;
}

export const auctionApi = {
  getRoomState: async (roomId: number): Promise<RoomStateResponse> => {
    const response = await api.get(`/api/rooms/${roomId}`);
    return response.data;
  },

  getBidHistory: async (auctionId: number): Promise<BidHistoryResponse> => {
    const response = await api.get(`/api/admin/auctions/${auctionId}/bids`);
    return response.data;
  },

  submitBid: async (auctionId: number, amount: number, userId: number) => {
    const response = await api.post(`/api/admin/auctions/${auctionId}/bid`, {
      userId,
      amount,
    });
    return response.data;
  },

  getAuctionLeaderboard: async (auctionId: number): Promise<LeaderboardResponse> => {
    try {
      const response = await api.get(`/api/admin/auctions/${auctionId}/leaderboard`);
      return response.data;
    } catch (error) {
      console.warn('排行榜接口暂未实现，返回空数据');
      return { success: true, code: 200, data: [] };
    }
  },
};
