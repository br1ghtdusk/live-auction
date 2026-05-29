import type { Auction } from './auction.types';

/**
 * WebSocket 接收消息接口定义（下行）
 */

export interface AuctionInfoData extends Auction {
  message?: string;
}

export interface AuctionInfoMessage {
  type: 'auction_info';
  data: AuctionInfoData;
}

export interface PriceUpdateMessage {
  type: 'price_update';
  data: {
    currentPrice: number;   // 分（整型）
    highestBidderId: number; // 最高出价人 ID
    endTime?: number;        // 最新结束时间（毫秒时间戳）
    extendCount?: number;    // 延时次数
  };
}

export interface AuctionEndedMessage {
  type: 'auction_ended';
  data: {
    winnerId: number | null;
    finalPrice: number;
    status: 'sold' | 'unsold';
    actualEndTime?: number;  // 实际成交时间
  };
}

export interface BidRejectedMessage {
  type: 'bid_rejected';
  data: {
    reason: 'auction_not_started' | 'auction_not_active' | 'auction_ended' | 'bid_too_low' | 'exceeds_ceiling';
    requiredMinBid?: number;
    requiredMaxBid?: number;
  };
}

export type AuctionWebSocketMessage = 
  | AuctionInfoMessage 
  | PriceUpdateMessage 
  | AuctionEndedMessage 
  | BidRejectedMessage;

/**
 * WebSocket 发送消息接口定义（上行契约，由 App.tsx 中 handleBid 提炼而来）
 */
export interface BidPayload {
  action: 'bid';
  auctionId: number;
  bidAmount: number;
  userId: number;
}