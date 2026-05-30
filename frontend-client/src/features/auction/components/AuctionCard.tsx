import React from 'react';
import { cn } from '../../../shared/utils/cn';
import { useAuctionSocket } from '../hooks/useAuctionSocket';
import { useAuctionStatus } from '../hooks/useAuctionStatus';
import { CountdownTimer } from './CountdownTimer';
import { PricePanel } from './PricePanel';
import { BidPanel } from './BidPanel';
import { formatPrice, formatCeilingPrice } from '../../../shared/utils/formatPrice';

interface AuctionCardProps {
  /** 统一的房间 WebSocket 地址 */
  wsUrl: string;
  /** 当前客户端用户 ID */
  myUserId: number;
}

export const AuctionCard: React.FC<AuctionCardProps> = ({ wsUrl, myUserId }) => {
  // 1. 接入网络流通信层 Hook
  const {
    auction,
    loading,
    error,
    isConnected,
    isSubmitting,
    placeBid,
  } = useAuctionSocket({ wsUrl, myUserId });

  // 2. 接入业务时序状态机 Hook
  const displayStatus = useAuctionStatus(auction);

  // 3. 全局接入或加载状态下的骨架保护机制
  if (loading || !auction) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-400 border-t-transparent mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">正在连接直播间...</h2>
          <p className="text-gray-300">{loading ? '正在加载商品信息...' : '等待连接服务器'}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-xl mb-4">❌ {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app" translate="no">
      {/* 核心架构收口：大单体静态骨架直接留在主文件里，杜绝多余的透传定义 */}
      <header className="app-header">
        <div className="header-content">
          <h1>🎯 实时竞拍大师</h1>
          <div className="header-right">
            <span className="user-id">👤 你的竞买人ID: {myUserId}</span>
            <span
              className={cn(
                'connection-status',
                isConnected ? 'connected' : 'disconnected'
              )}
            >
              {isConnected ? '🟢 在线' : '🔴 离线'}
            </span>
            <span className="live-badge">🔥 直播中</span>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="auction-card">
          {/* 左侧/上方：多媒体与视觉徽章展示区 */}
          <div className="card-image-wrapper">
            <img
              src={auction.image_url || 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=400'}
              alt={auction.name}
              className="card-image"
            />

            {/* 状态响应徽章 */}
            <span className={cn('status-badge', displayStatus.className)}>
              {displayStatus.label}
            </span>

            {/* ⏱️ 局部秒跳倒计时（仅在有确定目标且未结束时按需挂载） */}
            {displayStatus.countdownTarget > 0 && (
              <CountdownTimer
                targetTime={displayStatus.countdownTarget}
                isUrgent={displayStatus.isUrgent}
              />
            )}

            {/* 终局成交/流拍遮罩结果提示 */}
            {(auction.status === 'SOLD' || auction.status === 'FAILED') && (
              <div className="auction-result-badge">
                {auction.status === 'SOLD' ? (
                  <span>
                    <span className="result-icon">🎉</span>
                    <span className="result-text">
                      拍卖结束！成交人 ID: {auction.highest_bidder_id || '无'}
                    </span>
                  </span>
                ) : (
                  <span>
                    <span className="result-icon">😢</span>
                    <span className="result-text">拍卖流拍</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 右侧/下方：数据指标展现与动作面板 */}
          <div className="card-content">
            <h2 className="card-title">{auction.name}</h2>

            {displayStatus.subtext && (
              <p className="status-subtext">{displayStatus.subtext}</p>
            )}

            {/* 💰 高频价格面板 */}
            <PricePanel
              startPrice={auction.start_price}
              currentPrice={auction.current_price}
              status={auction.status}
            />

            <div className="increment-info">
              <span className="increment-label">加价幅度：</span>
              <span className="increment-value">{formatPrice(auction.bid_increment)}</span>
            </div>

            <div className="ceiling-info">
              <span className="ceiling-label">封顶价：</span>
              <span className="ceiling-value">{formatCeilingPrice(auction.ceiling_price)}</span>
            </div>

            {auction.extend_count > 0 && (
              <div className="extend-info">
                <span className="extend-label">已延时：</span>
                <span className="extend-value">{auction.extend_count} 次</span>
              </div>
            )}

            {/* 🚀 纯净出价控制按钮 */}
            <BidPanel
              bidIncrement={auction.bid_increment}
              canBid={displayStatus.canBid}
              isSubmitting={isSubmitting}
              onBid={() => placeBid(displayStatus.canBid)}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default AuctionCard;
