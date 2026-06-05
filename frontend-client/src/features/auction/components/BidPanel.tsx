import React from 'react';
import { cn } from '../../../shared/utils/cn';
import { formatPrice } from '../../../shared/utils/formatPrice';

interface BidPanelProps {
  /** 当前价格（分） */
  currentPrice: number;
  /** 当前加价幅度（分） */
  bidIncrement: number;
  /** 是否允许出价（由业务状态机决定） */
  canBid: boolean;
  /** 网络乐观锁状态，是否正在上行请求中 */
  isSubmitting: boolean;
  /** 触发上行出价动作的回调 */
  onBid: () => void;
  /** 禁用原因提示文本 */
  disabledReason?: string;
}

export const BidPanel: React.FC<BidPanelProps> = React.memo(({
  currentPrice,
  bidIncrement,
  canBid,
  isSubmitting,
  onBid,
  disabledReason,
}) => {
  const isButtonActive = canBid && !isSubmitting;
  const nextBidPrice = currentPrice + bidIncrement;

  return (
    <button
      className={cn('bid-button', isButtonActive ? 'active' : 'disabled')}
      onClick={onBid}
      disabled={!isButtonActive}
    >
      {isButtonActive ? (
        <>
          <span className="bid-action">立即出价</span>
          <span className="bid-price">{formatPrice(nextBidPrice)}</span>
        </>
      ) : isSubmitting ? (
        '处理中...'
      ) : (
        disabledReason || '当前不支持出价'
      )}
    </button>
  );
});

BidPanel.displayName = 'BidPanel';
