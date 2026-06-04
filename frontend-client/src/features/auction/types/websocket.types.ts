import type { Auction } from './auction.types';

/**
 * WebSocket 接收消息接口定义（下行）
 * 已废弃 auction_info 协议，全面使用 room_display 协议
 */

/**
 * 首屏/状态变更消息（主协议）
 */
export interface RoomDisplayMessage {
  type: 'room_display';
  data: {
    mode: 'ACTIVE' | 'RESULT' | 'IDLE';
    auction: Auction | null;
  };
}

/**
 * 价格更新消息
 */
export interface PriceUpdateMessage {
  type: 'price_update';
  data: {
    currentPrice: number;   // 分（整型）
    highestBidderId: number; // 最高出价人 ID
    endTime?: number;        // 最新结束时间（毫秒时间戳）
    extendCount?: number;    // 延时次数
  };
}

/**
 * 拍卖结束消息
 */
export interface AuctionEndedMessage {
  type: 'auction_ended';
  data: {
    winnerId: number | null;
    finalPrice: number;
    status: 'SOLD' | 'FAILED' | 'CANCELLED';
    actualEndTime?: number;  // 实际成交时间
    cancelReason?: string;   // 取消原因
  };
}

/**
 * 出价被拒绝消息
 */
export interface BidRejectedMessage {
  type: 'bid_rejected';
  data: {
    reason: 'auction_not_started' | 'auction_not_active' | 'auction_ended' | 'bid_too_low' | 'exceeds_ceiling';
    requiredMinBid?: number;
    requiredMaxBid?: number;
  };
}

/**
 * WebSocket 消息联合类型
 */
export type AuctionWebSocketMessage = 
  | RoomDisplayMessage
  | PriceUpdateMessage 
  | AuctionEndedMessage 
  | BidRejectedMessage;

/**
 * WebSocket 发送消息接口定义（上行）
 */
export interface BidPayload {
  action: 'bid';
  auctionId: number;
  bidAmount: number;
  userId: number;
}
