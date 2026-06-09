import axios from 'axios';

// 🌟 动态获取当前域名/IP，强制使用后端8081端口
// 不读取 .env 配置，避免 localhost 覆盖动态获取
const API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:8081`;

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
  data: {
    list: Array<{
      userId: number;
      username: string;
      maxBidAmount: number;  // 最高出价（分）
      bidCount: number;      // 出价次数
    }>;
    bidderCount: number;
  };
}

export interface RoomDisplayStateResponse {
  success: boolean;
  code: number;
  data: {
    mode: 'ACTIVE' | 'RESULT' | 'IDLE';
    auction?: any;
    bidderCount: number;
  };
}

export interface PayAuctionResponse {
  success: boolean;
  code?: number;
  message?: string;
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
      return { success: true, code: 200, data: { list: [], bidderCount: 0 } };
    }
  },

  // 获取房间展示状态（用于断线重连和页面唤醒同步）
  getRoomDisplayState: async (roomId: number): Promise<RoomDisplayStateResponse> => {
    const response = await api.get(`/api/rooms/${roomId}/display-state`);
    return response.data;
  },

  // 支付订单
  payOrder: async (auctionId: number, userId: number): Promise<PayAuctionResponse> => {
    try {
      const response = await api.post(`/api/pay`, {
        auctionId,
        userId,
      });
      return response.data;
    } catch (error: any) {
      console.error('[Payment API] 支付请求失败:', error);
      if (error.response?.data) {
        return error.response.data;
      }
      return {
        success: false,
        code: 'ERROR',
        message: '支付失败',
      };
    }
  },
};
