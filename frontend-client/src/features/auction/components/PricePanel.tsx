import React from 'react';
import { formatPrice } from '../../../shared/utils/formatPrice';
import type { AuctionStatus } from '../constants/auctionStatus';

interface PricePanelProps {
  startPrice: number;
  currentPrice: number;
  status: AuctionStatus;
}

export const PricePanel: React.FC<PricePanelProps> = React.memo(({
  startPrice,
  currentPrice,
  status,
}) => {
  if (status === 'FAILED') {
    return (
      <div className="price-section">
        <div className="price-item w-full">
          <span className="price-label text-gray-400">拍卖结果</span>
          <span className="price-value text-gray-400 text-lg">
            无人出价，已流拍
          </span>
        </div>
      </div>
    );
  }

  if (status === 'SOLD') {
    return (
      <div className="price-section">
        <div className="price-item">
          <span className="price-label">起拍价</span>
          <span className="price-value starting">
            {formatPrice(startPrice)}
          </span>
        </div>
        <div className="price-item current-price">
          <span className="price-label">落槌价</span>
          <span key={currentPrice} className="price-value current price-flash">
            {formatPrice(currentPrice)}
          </span>
        </div>
      </div>
    );
  }

  const hasBid = currentPrice > startPrice;

  return (
    <div className="price-section">
      <div className="price-item">
        <span className="price-label">起拍价</span>
        <span className="price-value starting">
          {formatPrice(startPrice)}
        </span>
      </div>
      <div className="price-item current-price">
        <span className="price-label">{hasBid ? '当前最高' : '起拍价'}</span>
        <span key={currentPrice} className="price-value current price-flash">
          {formatPrice(currentPrice)}
        </span>
      </div>
    </div>
  );
});

PricePanel.displayName = 'PricePanel';
