import { useState } from 'react';
import useWebSocket from '../../../hooks/useWebSocket';
import type { AuctionStatus } from '../constants/auctionStatus';
import type { Auction } from '../types/auction.types';
import { sanitizeAuctionData } from '../utils/sanitizeAuction';
import { getBidRejectedReason } from '../utils/getBidRejectedReason';
import { auctionSocketService } from '../services/auction.socket';
import type { AuctionWebSocketMessage } from '../types/websocket.types';

export type RoomDisplayMode = 'ACTIVE' | 'RESULT' | 'IDLE';

interface UseAuctionSocketOptions {
  wsUrl: string;
  myUserId: number;
}

export const useAuctionSocket = ({ wsUrl, myUserId }: UseAuctionSocketOptions) => {
  const [auction, setAuction] = useState<Auction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [roomDisplayMode, setRoomDisplayMode] = useState<RoomDisplayMode>('IDLE');

  const { isConnected, sendMessage } = useWebSocket<AuctionWebSocketMessage>({
    url: wsUrl,
    initialReconnectDelay: 3000,
    onConnect: () => {
      setError(null);
    },
    onDisconnect: () => {
      console.log('[useAuctionSocket] 直播间连接已断开');
    },
    onMessage: (message) => {
      console.log('[useAuctionSocket] 接收到业务消息类型:', message.type);

      switch (message.type) {
        case 'room_display': {
          const { mode, auction: auctionData } = message.data;
          setRoomDisplayMode(mode as RoomDisplayMode);
          
          if (auctionData) {
            const cleanedAuction = sanitizeAuctionData(auctionData);
            setAuction(cleanedAuction);
          } else {
            setAuction(null);
          }
          setLoading(false);
          break;
        }

        case 'price_update': {
          const newPrice = message.data.currentPrice;

          setAuction((prev) => {
            if (!prev) return null;
            if (newPrice <= prev.current_price) {
              console.warn(`[useAuctionSocket] 拦截并发过期出价。收到: ${newPrice}, 当前最新: ${prev.current_price}`);
              return prev;
            }
            console.log(`[useAuctionSocket] ✅ 检测到有效价格更新: ${prev.current_price} → ${newPrice}`);
            
            const newStatus = prev.status === 'WAITING' ? 'BIDDING' as AuctionStatus : prev.status;
            
            return {
              ...prev,
              current_price: newPrice,
              highest_bidder_id: message.data.highestBidderId,
              scheduled_end_time: message.data.endTime ?? prev.scheduled_end_time,
              extend_count: message.data.extendCount ?? prev.extend_count,
              status: newStatus,
            };
          });

          setIsSubmitting(false);
          break;
        }

        case 'auction_ended': {
          const endData = message.data;
          let newStatus: AuctionStatus;
          if (endData.status === 'SOLD') {
            newStatus = 'SOLD';
          } else if (endData.status === 'CANCELLED') {
            newStatus = 'CANCELLED';
          } else {
            newStatus = 'FAILED';
          }
          
          setAuction((prev) =>
            prev
              ? {
                  ...prev,
                  status: newStatus,
                  current_price: endData.finalPrice || prev.current_price,
                  highest_bidder_id: endData.winnerId || prev.highest_bidder_id,
                  actual_end_time: endData.actualEndTime ?? null,
                  cancel_reason: endData.cancelReason ?? null,
                }
              : null
          );
          setIsSubmitting(false);
          break;
        }

        case 'bid_rejected': {
          setIsSubmitting(false);
          const alertMessage = getBidRejectedReason(
            message.data.reason,
            message.data.requiredMinBid,
            message.data.requiredMaxBid
          );
          alert(alertMessage);
          break;
        }
      }
    },
  });

  const placeBid = (canBid: boolean) => {
    if (!auction) {
      alert('商品数据未就绪，请稍后');
      return;
    }

    if (isSubmitting) {
      console.log('[useAuctionSocket] 上次出价处理中，拦截重复点击');
      return;
    }

    if (!canBid) {
      alert('当前状态不支持出价');
      return;
    }

    const nextBidAmount = Math.min(
      auction.current_price + auction.bid_increment,
      auction.ceiling_price
    );

    setIsSubmitting(true);
    console.log(`[useAuctionSocket] 发起出价动作. 当前服务器价: ${auction.current_price}, 触顶收口计算价: ${nextBidAmount}`);

    const success = auctionSocketService.sendBid(sendMessage, {
      auctionId: auction.id,
      bidAmount: nextBidAmount,
      userId: myUserId,
    });

    if (!success) {
      setIsSubmitting(false);
      alert('直播间网络发送失败，请检查网络连接');
    }
  };

  return {
    auction,
    loading,
    error,
    isConnected,
    isSubmitting,
    roomDisplayMode,
    placeBid,
  };
};