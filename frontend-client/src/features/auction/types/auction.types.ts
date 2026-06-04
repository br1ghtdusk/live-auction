import type { AuctionStatus } from '../constants/auctionStatus';
/**
 * 商品数据接口定义
 * 注意：后端返回的价格字段都是"分"单位，存储为 number 类型
 */
export interface Auction {
  id: number;
  name: string;
  image_url?: string | null;
  start_price: number;       // 起拍价（分）
  current_price: number;     // 当前价格（分）
  bid_increment: number;     // 加价幅度（分）
  ceiling_price: number;     // 封顶价（分）
  status: AuctionStatus;     // 状态
  scheduled_start_time: number; // 计划开始时间（毫秒）
  scheduled_end_time: number;   // 计划结束时间（毫秒）
  actual_start_time: number | null; // 实际开始时间（毫秒）
  actual_end_time: number | null;   // 实际结束时间（毫秒）
  extend_count: number;     // 延时次数
  highest_bidder_id: number | null;
  cancel_reason?: string | null; // 取消原因
  created_at: string;
  updated_at: string;
}

