import type { Auction } from '../types/auction.types';
import type { AuctionStatus } from '../constants/auctionStatus';
/**
 * 数据清洗防腐层（Sanitization Layer）
 * 将后端返回的原始数据安全转换为强类型的 Auction 对象
 */
export const sanitizeAuctionData = (rawData: any): Auction | null => {
  if (!rawData || typeof rawData !== 'object') {
    return null;
  }

  return {
    id: Number(rawData.id) || 0,
    name: String(rawData.name || ''),
    image_url: rawData.image_url || null,
    start_price: Number(rawData.start_price) || 0,
    current_price: Number(rawData.current_price) || 0,
    bid_increment: Number(rawData.bid_increment) || 0,
    ceiling_price: Number(rawData.ceiling_price) || 0,
    status: (rawData.status || 'WAITING') as AuctionStatus,
    scheduled_start_time: Number(rawData.scheduled_start_time ?? 0),
    scheduled_end_time: Number(rawData.scheduled_end_time ?? 0),
    actual_start_time: rawData.actual_start_time ? Number(rawData.actual_start_time) : null,
    actual_end_time: rawData.actual_end_time ? Number(rawData.actual_end_time) : null,
    extend_count: Number(rawData.extend_count) || 0,
    highest_bidder_id: rawData.highest_bidder_id ? Number(rawData.highest_bidder_id) : null,
    created_at: String(rawData.created_at || ''),
    updated_at: String(rawData.updated_at || ''),
  };
};