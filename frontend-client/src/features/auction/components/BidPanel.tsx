import React, { useState, useEffect } from 'react';
import { cn } from '../../../shared/utils/cn';
import { formatPrice } from '../../../shared/utils/formatPrice';
import { BidConfirmModal } from './BidConfirmModal';
import './BidPanel.css';

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
  onBid: (amount: number) => void;
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
  const minNextBid = currentPrice + bidIncrement;
  const [customAmount, setCustomAmount] = useState<number>(minNextBid);
  const [inputValue, setInputValue] = useState<string>((minNextBid / 100).toFixed(2));
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 当外部价格变化时，同步内部最小出价
  useEffect(() => {
    const nextBid = Math.max(customAmount, minNextBid);
    setCustomAmount(nextBid);
    setInputValue((nextBid / 100).toFixed(2));
    setIsModalOpen(false);
  }, [currentPrice, minNextBid]);

  const isButtonActive = canBid && !isSubmitting;

  const adjustAmount = (diff: number) => {
    const newAmount = Math.max(minNextBid, customAmount + diff);
    setCustomAmount(newAmount);
    setInputValue((newAmount / 100).toFixed(2));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    const amountInCents = Math.round(Number(inputValue) * 100);
    if (isNaN(amountInCents) || amountInCents < minNextBid) {
      setInputValue((minNextBid / 100).toFixed(2));
      setCustomAmount(minNextBid);
    } else {
      setCustomAmount(amountInCents);
      setInputValue((amountInCents / 100).toFixed(2));
    }
  };

  const handleBidClick = () => {
    const amountInCents = Math.round(Number(inputValue) * 100);
    if (isNaN(amountInCents) || amountInCents < minNextBid) {
      return;
    }
    setIsModalOpen(true);
  };

  const handleConfirmBid = () => {
    const amountInCents = Math.round(Number(inputValue) * 100);
    onBid(amountInCents);
    setIsModalOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBidClick();
    }
  };

  return (
    <div className="bid-controls-container">
      <div className={cn("bid-input-group", !isButtonActive && "disabled")}>
        <button 
          className="adjust-btn" 
          onClick={() => adjustAmount(-bidIncrement)}
          disabled={!isButtonActive}
          aria-label="减少出价"
        >
          -
        </button>
        <div className="input-wrapper">
          <span className="currency-symbol">¥</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            disabled={!isButtonActive}
            className="bid-amount-input tabular"
          />
          <span className="input-hint-mini">最低 {formatPrice(minNextBid)}</span>
        </div>
        <button 
          className="adjust-btn" 
          onClick={() => adjustAmount(bidIncrement)}
          disabled={!isButtonActive}
          aria-label="增加出价"
        >
          +
        </button>
      </div>

      <button
        className={cn('bid-button', isButtonActive ? 'active' : 'disabled')}
        onClick={handleBidClick}
        disabled={!isButtonActive}
      >
        {isSubmitting ? (
          '处理中...'
        ) : isButtonActive ? (
          '确认出价'
        ) : (
          disabledReason || '当前不支持出价'
        )}
      </button>

      <BidConfirmModal
        isOpen={isModalOpen}
        amount={Math.round(Number(inputValue) * 100)}
        onConfirm={handleConfirmBid}
        onCancel={() => setIsModalOpen(false)}
      />
    </div>
  );
});

BidPanel.displayName = 'BidPanel';
