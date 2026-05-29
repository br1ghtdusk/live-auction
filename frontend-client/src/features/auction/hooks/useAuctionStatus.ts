import { useState, useEffect } from 'react';
import type { Auction } from '../types/auction.types';

export interface DisplayStatus {
  label: string;
  className: string;
  subtext: string;
  canBid: boolean;
  countdownTarget: number; // 倒计时目标时间（0表示不显示倒计时）
  isUrgent: boolean;       // 是否进入最后冲刺临界点（如小于60秒）
}

export const useAuctionStatus = (auction: Auction | null): DisplayStatus => {
  const [now, setNow] = useState(Date.now());

  // 状态适配器需要每秒感知一次时间，用于触发临界状态转换（例如从未开始变为等待首次出价）
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const defaultStatus: DisplayStatus = {
    label: '未知状态',
    className: 'status-unknown',
    subtext: '',
    canBid: false,
    countdownTarget: 0,
    isUrgent: false,
  };

  if (!auction) return defaultStatus;

  const { status, scheduled_start_time, scheduled_end_time, actual_end_time } = auction;

  // 1. 已明确结束的物理状态
  if (status === 'SOLD') {
    return {
      ...defaultStatus,
      label: '已成交',
      className: 'status-sold',
      subtext: actual_end_time ? `成交时间: ${new Date(actual_end_time).toLocaleString()}` : '',
    };
  }

  if (status === 'FAILED') {
    return {
      ...defaultStatus,
      label: '流拍',
      className: 'status-failed',
      subtext: actual_end_time ? `流拍时间: ${new Date(actual_end_time).toLocaleString()}` : '',
    };
  }

  if (status === 'CANCELLED') {
    return {
      ...defaultStatus,
      label: '已取消',
      className: 'status-cancelled',
    };
  }

  // 2. 竞拍未开始
  if (now < scheduled_start_time) {
    return {
      label: '竞拍未开始',
      className: 'status-waiting-start',
      subtext: '静候开拍',
      canBid: false,
      countdownTarget: scheduled_start_time,
      isUrgent: false,
    };
  }

  // 3. WAITING 状态且时间已过开始时间 -> 等待首次出价鸣枪
  if (status === 'WAITING' && now >= scheduled_start_time) {
    const remainingSeconds = Math.floor((scheduled_end_time - now) / 1000);
    return {
      label: '等待首次出价',
      className: 'status-waiting-bid',
      subtext: '出价即可鸣枪开拍',
      canBid: true,
      countdownTarget: scheduled_end_time,
      isUrgent: remainingSeconds > 0 && remainingSeconds <= 60,
    };
  }

  // 4. BIDDING 状态进行中
  if (status === 'BIDDING') {
    if (now > scheduled_end_time) {
      return {
        label: '即将结算',
        className: 'status-settling',
        subtext: '系统正在结算中...',
        canBid: false,
        countdownTarget: 0,
        isUrgent: false,
      };
    }

    const remainingSeconds = Math.floor((scheduled_end_time - now) / 1000);
    return {
      label: '竞拍中',
      className: 'status-active',
      subtext: '',
      canBid: true,
      countdownTarget: scheduled_end_time,
      isUrgent: remainingSeconds > 0 && remainingSeconds <= 60, // 💡 绝杀机制：最后60秒进入红名紧急状态
    };
  }

  return defaultStatus;
};