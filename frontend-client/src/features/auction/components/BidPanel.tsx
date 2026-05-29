import React from 'react';
import { cn } from '../../../shared/utils/cn';
import { formatPrice } from '../../../shared/utils/formatPrice';

interface BidPanelProps {
  /** 当前加价幅度（分） */
  bidIncrement: number;
  /** 是否允许出价（由业务状态机决定） */
  canBid: boolean;
  /** 网络乐观锁状态，是否正在上行请求中 */
  isSubmitting: boolean;
  /** 触发上行出价动作的回调 */
  onBid: () => void;
}

export const BidPanel: React.FC<BidPanelProps> = React.memo(({
  bidIncrement,
  canBid,
  isSubmitting,
  onBid,
}) => {
  const isButtonActive = canBid && !isSubmitting;

  return (
    <button
      className={cn('bid-button', isButtonActive ? 'active' : 'disabled')}
      onClick={onBid}
      disabled={!isButtonActive}
    >
      <span>
        {isButtonActive ? (
          <>
            <span className="bid-icon">💰</span>
            <span>出价 (+{formatPrice(bidIncrement)})</span>
          </>
        ) : isSubmitting ? (
          '处理中...'
        ) : (
          '当前不支持出价'
        )}
      </span>
    </button>
  );
});

BidPanel.displayName = 'BidPanel';
