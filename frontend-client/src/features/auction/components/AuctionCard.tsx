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
    roomDisplayMode,
    placeBid,
  } = useAuctionSocket({ wsUrl, myUserId });

  // 2. 接入业务时序状态机 Hook
  const displayStatus = useAuctionStatus(auction);

  // 3. 全局接入或加载状态下的骨架保护机制
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-400 border-t-transparent mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">正在连接直播间...</h2>
          <p className="text-gray-300">正在加载商品信息...</p>
        </div>
      </div>
    );
  }
  // 4. 房间没有拍品的提示 (IDLE 状态)
  if (roomDisplayMode === "IDLE") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📦</div>
          <h2 className="text-2xl font-bold text-white mb-2">当前直播间暂无拍品</h2>
          <p className="text-gray-300">主播尚未上架任何竞拍商品，请稍后再来</p>
          <div className="mt-6">
            <span className="inline-block px-4 py-2 bg-purple-600/30 text-purple-300 rounded-full text-sm">
              房间 ID: {new URLSearchParams(window.location.search).get('roomId')}
            </span>
          </div>
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

  // 根据 RoomDisplayMode 渲染不同状态
  const renderContent = () => {
    switch (roomDisplayMode) {
      case 'ACTIVE':
        return renderActiveMode();
      case 'RESULT':
        return renderResultMode();
      default:
        return renderActiveMode();
    }
  };

  // ACTIVE 模式：竞拍进行中
  const renderActiveMode = () => (
    <div className="app" translate="no">
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
          <div className="card-image-wrapper">
            <img
              src={auction.image_url || 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=400'}
              alt={auction.name}
              className="card-image"
            />

            <span className={cn('status-badge', displayStatus.className)}>
              {displayStatus.label}
            </span>

            {/* ⏱️ 局部秒跳倒计时 */}
            {displayStatus.countdownTarget > 0 && (
              <CountdownTimer
                targetTime={displayStatus.countdownTarget}
                isUrgent={displayStatus.isUrgent}
              />
            )}
          </div>

          <div className="card-content">
            <h2 className="card-title">{auction.name}</h2>

            {displayStatus.subtext && (
              <p className="status-subtext">{displayStatus.subtext}</p>
            )}

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

  // RESULT 模式：最近结束的拍卖
  const renderResultMode = () => (
    <div className="app" translate="no">
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
          <div className="card-image-wrapper">
            <img
              src={auction.image_url || 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=400'}
              alt={auction.name}
              className="card-image"
            />

            <span className={cn('status-badge', displayStatus.className)}>
              {displayStatus.label}
            </span>

            {/* 终局成交/流拍/取消遮罩结果提示 */}
            <div className="auction-result-badge">
              {auction.status === 'SOLD' ? (
                <span>
                  <span className="result-icon">🎉</span>
                  <span className="result-text">
                    恭喜成交！获胜用户: {auction.highest_bidder_id || '无'}
                  </span>
                </span>
              ) : auction.status === 'CANCELLED' ? (
                <span>
                  <span className="result-icon">🚫</span>
                  <span className="result-text">
                    拍卖已取消: {auction.cancel_reason || '商家紧急取消'}
                  </span>
                </span>
              ) : (
                <span>
                  <span className="result-icon">😢</span>
                  <span className="result-text">拍卖流拍</span>
                </span>
              )}
            </div>
          </div>

          <div className="card-content">
            <h2 className="card-title">{auction.name}</h2>

            {displayStatus.subtext && (
              <p className="status-subtext">{displayStatus.subtext}</p>
            )}

            {/* 显示最终成交价 */}
            <div className="final-price-panel">
              <div className="final-price-label">最终成交价</div>
              <div className="final-price-value">
                {auction.status === 'SOLD' ? (
                  <span className="text-green-400">¥{formatPrice(auction.current_price)}</span>
                ) : (
                  <span className="text-gray-400">¥{formatPrice(auction.current_price)}</span>
                )}
              </div>
            </div>

            {/* 显示获胜用户信息 */}
            {auction.status === 'SOLD' && auction.highest_bidder_id && (
              <div className="winner-info">
                <span className="winner-label">🏆 获胜用户:</span>
                <span className="winner-value">用户 {auction.highest_bidder_id}</span>
              </div>
            )}

            <div className="increment-info">
              <span className="increment-label">加价幅度：</span>
              <span className="increment-value">{formatPrice(auction.bid_increment)}</span>
            </div>

            <div className="ceiling-info">
              <span className="ceiling-label">封顶价：</span>
              <span className="ceiling-value">{formatCeilingPrice(auction.ceiling_price)}</span>
            </div>

            {/* 禁用的出价按钮 */}
            <BidPanel
              bidIncrement={auction.bid_increment}
              canBid={false}
              isSubmitting={false}
              onBid={() => {}}
              disabledReason="拍卖已结束"
            />
          </div>
        </div>
      </main>
    </div>
  );

  return renderContent();
};

export default AuctionCard;