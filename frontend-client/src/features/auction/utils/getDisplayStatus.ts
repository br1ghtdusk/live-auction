import type { Auction } from '../types/auction.types';
import { formatTimestamp} from '../../../shared/utils/formatTime';
import { formatPrice } from '../../../shared/utils/formatPrice';
/**
 * 获取显示状态信息（包含核心倒计时、一键触顶等状态判定）
 */
export const getDisplayStatus = (auction: Auction, now: number) => {
  const { status, scheduled_start_time, scheduled_end_time, actual_start_time, actual_end_time } = auction;

  if (status === 'SOLD') {
    return {
      label: '已成交',
      className: 'status-sold',
      canBid: false,
      subtext: actual_end_time ? `成交时间: ${formatTimestamp(actual_end_time)}` : '',
      countdown: 0,
      urgent: false,
    };
  }

  if (status === 'FAILED') {
    return {
      label: '流拍',
      className: 'status-failed',
      canBid: false,
      subtext: actual_end_time ? `流拍时间: ${formatTimestamp(actual_end_time)}` : '',
      countdown: 0,
      urgent: false,
    };
  }

  if (status === 'CANCELLED') {
    return {
      label: '已取消',
      className: 'status-cancelled',
      canBid: false,
      subtext: '',
      countdown: 0,
      urgent: false,
    };
  }

  if (now < scheduled_start_time) {
    const remaining = scheduled_start_time - now;
    const seconds = Math.floor(remaining / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return {
      label: '竞拍未开始',
      className: 'status-waiting-start',
      canBid: false,
      subtext: `距离开拍还有 ${minutes}分${secs}秒`,
      countdown: seconds,
      urgent: false,
    };
  }

  if (status === 'WAITING' && now >= scheduled_start_time) {
    return {
      label: '等待首次出价',
      className: 'status-waiting-bid',
      canBid: true,
      subtext: '出价即可鸣枪开拍',
      countdown: Math.max(0, Math.floor((scheduled_end_time - now) / 1000)),
      urgent: false,
    };
  }

  if (status === 'BIDDING') {
    if (now > scheduled_end_time) {
      return {
        label: '即将结算',
        className: 'status-settling',
        canBid: false,
        subtext: '系统正在结算中...',
        countdown: 0,
        urgent: false,
      };
    }

    const remaining = scheduled_end_time - now;
    const seconds = Math.max(0, Math.floor(remaining / 1000));
    return {
      label: '竞拍中',
      className: 'status-active',
      canBid: true,
      subtext: actual_start_time ? `已进行 ${Math.floor((now - actual_start_time) / 60000)} 分钟` : '',
      countdown: seconds,
      urgent: seconds < 10 && seconds > 0,
    };
  }

  return {
    label: status,
    className: 'status-unknown',
    canBid: false,
    subtext: '',
    countdown: 0,
    urgent: false,
  };
};

/**
 * 拒绝出价原因映射表（将 WS 报错信息转化为对用户友好的文案）
 */
export const getBidRejectedReason = (reason: string, requiredMinBid?: number, requiredMaxBid?: number): string => {
  const reasonMap: Record<string, string> = {
    'auction_not_started': '竞拍还未开始',
    'auction_not_active': '当前商品不支持出价',
    'auction_ended': '竞拍已结束',
    'bid_too_low': `出价过低，最低需要 ${requiredMinBid ? formatPrice(requiredMinBid) : ''}`,
    'exceeds_ceiling': `出价超过封顶价，最高出价 ${requiredMaxBid ? formatPrice(requiredMaxBid) : ''}`,
  };
  return reasonMap[reason] || reason;
};