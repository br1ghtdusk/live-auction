import type { BidPayload } from '../types/websocket.types';

/**
 * 拍卖 WebSocket 协议服务
 */
export const auctionSocketService = {
  /**
   * 构建并发送出价请求报文
   * @param sendMessage 底层 WS 发送函数
   * @param params 出价参数
   */
  sendBid(
    sendMessage: (message: object) => boolean,
    params: { auctionId: number; bidAmount: number; userId: number }
  ): boolean {
    const payload: BidPayload = {
      action: 'bid',
      auctionId: params.auctionId,
      bidAmount: params.bidAmount,
      userId: params.userId,
    };
    
    console.log('[Service] 发送出价请求:', payload);
    return sendMessage(payload);
  },
};