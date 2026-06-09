import React from 'react';
import { Frown } from 'lucide-react';
import { formatPrice } from '../../../shared/utils/formatPrice';
import type { AuctionStatus } from '../constants/auctionStatus';
import './PricePanel.css';

interface PricePanelProps {
  startPrice: number;
  currentPrice: number;
  bidIncrement: number;
  status?: AuctionStatus | null | undefined;
}

export const PricePanel: React.FC<PricePanelProps> = React.memo(({
  startPrice,
  currentPrice,
  bidIncrement,
  status,
}) => {
  if (status === 'FAILED') {
    return (
      <div className="price-section-failed">
        <Frown className="w-5 h-5 text-red-400 inline mr-2" />
        <span className="failed-text">无人出价，已流拍</span>
      </div>
    );
  }

  if (status === 'SOLD') {
    return (
      <div className="price-section-result">
        <div className="result-label">成交价</div>
        <div key={currentPrice} className="result-price price-flash">
          {formatPrice(currentPrice)}
        </div>
      </div>
    );
  }

  const hasBid = currentPrice > startPrice;

  return (
    <div className="price-section-active">
      <div className="current-price-block">
        <span className="current-label">{hasBid ? '当前价' : '起拍价'}</span>
        <span key={currentPrice} className="current-value price-flash">
          {formatPrice(currentPrice)}
        </span>
      </div>
      <div className="increment-row">
        <span className="increment-hint">
          加价幅度 {formatPrice(bidIncrement)}
        </span>
      </div>
    </div>
  );
});

PricePanel.displayName = 'PricePanel';
