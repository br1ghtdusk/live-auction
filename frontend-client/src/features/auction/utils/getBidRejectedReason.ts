import { formatPrice } from '../../../shared/utils/formatPrice';

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