import { useAuctionStatus } from '../hooks/useAuctionStatus';
import { CountdownTimer } from './CountdownTimer';
import { PricePanel } from './PricePanel';
import { BidPanel } from './BidPanel';
import { formatPrice } from '../../../shared/utils/formatPrice';
import { useAuctionStore } from '../hooks/useAuctionstore';
import './AuctionCard.css';

const AuctionCard = () => {
  const {
    currentAuction: auction,
    loading,
    error,
    isConnected,
    isSubmitting,
    roomDisplayMode,
    myUserId,
    submitBid,
  } = useAuctionStore();

  const displayStatus = useAuctionStatus(auction);

  // 加载状态
  if (loading) {
    return (
      <div className="auction-card auction-card-loading">
        <div className="loading-content">
          <div className="loading-spinner" />
          <span>连接中...</span>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="auction-card auction-card-error">
        <span>{error}</span>
        <button onClick={() => window.location.reload()}>重试</button>
      </div>
    );
  }

  // 空闲状态 - 显示优雅的等待看板
  if (!auction || roomDisplayMode === 'IDLE') {
    return (
      <div className="auction-card auction-card-idle">
        <div className="idle-content">
          <span className="idle-icon">🎁</span>
          <span className="idle-title">等一下下</span>
          <span className="idle-subtitle">主播正在准备宝贝...</span>
          <span className="idle-hint">✨ 下一件宝贝即将登场，敬请期待！</span>
        </div>
      </div>
    );
  }

  // 活动模式渲染
  const renderActiveMode = () => (
    <div className="auction-card-content">
      {/* 顶部状态栏 - 精简 */}
      <div className="card-top-bar">
        <span className={`live-indicator ${isConnected ? 'connected' : ''}`}>
          {isConnected ? '🟢' : '🔴'} 直播中
        </span>
        <span className="user-id-mini">ID: {myUserId}</span>
      </div>

      {/* 商品图片 + 倒计时 */}
      <div className="card-image-wrapper">
        <img
          src={auction?.image_url || 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=400'}
          alt={auction?.name || '拍品'}
          className="card-image"
        />
        <span className={`status-badge ${displayStatus?.className || ''}`}>
          {displayStatus?.label || '未知'}
        </span>
        {displayStatus?.countdownTarget > 0 && (
          <CountdownTimer
            targetTime={displayStatus.countdownTarget}
            isUrgent={displayStatus?.isUrgent || false}
          />
        )}
      </div>

      {/* 核心信息区 */}
      <div className="card-body">
        <h2 className="card-title">{auction?.name || '未命名拍品'}</h2>

        <PricePanel
          startPrice={auction?.start_price || 0}
          currentPrice={auction?.current_price || 0}
          bidIncrement={auction?.bid_increment || 0}
          status={auction?.status}
        />

        <BidPanel
          currentPrice={auction?.current_price || 0}
          bidIncrement={auction?.bid_increment || 0}
          canBid={displayStatus?.canBid || false}
          isSubmitting={isSubmitting}
          onBid={() => {
            if (displayStatus?.canBid && auction?.current_price !== undefined && auction?.bid_increment !== undefined) {
              const nextBidAmount = auction.current_price + auction.bid_increment;
              submitBid(nextBidAmount);
            }
          }}
        />
      </div>
    </div>
  );

  // 结果模式渲染
  const renderResultMode = () => (
    <div className="auction-card-content result-mode">
      {/* 结果遮罩 */}
      <div className="result-overlay">
        <div className="result-content">
          {auction?.status === 'SOLD' ? (
            <>
              <span className="result-emoji">🎉</span>
              <span className="result-title">成交</span>
            </>
          ) : auction?.status === 'CANCELLED' ? (
            <>
              <span className="result-emoji">🚫</span>
              <span className="result-title">已取消</span>
            </>
          ) : (
            <>
              <span className="result-emoji">😢</span>
              <span className="result-title">流拍</span>
            </>
          )}
        </div>
      </div>

      {/* 商品图片 */}
      <div className="card-image-wrapper small">
        <img
          src={auction?.image_url || 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=400'}
          alt={auction?.name || '拍品'}
          className="card-image"
        />
      </div>

      {/* 结果信息 - 精简 */}
      <div className="card-body result-body">
        <h2 className="card-title">{auction?.name || '未命名拍品'}</h2>

        <div className="result-price-section">
          <span className="result-label">
            {auction?.status === 'SOLD' ? '成交价' : '最终价'}
          </span>
          <span className={`result-value ${auction?.status === 'SOLD' ? 'sold' : ''}`}>
            {formatPrice(auction?.current_price || 0)}
          </span>
        </div>

        {auction?.status === 'SOLD' && auction?.highest_bidder_id && (
          <div className="winner-section">
            <span className="winner-badge">🏆 获胜者</span>
            <span className="winner-id">用户 {auction.highest_bidder_id}</span>
          </div>
        )}
      </div>
    </div>
  );

  // 判断是活动模式还是结果模式
  const isResultMode = ['SOLD', 'CANCELLED', 'FAILED', 'FINISHED'].includes(auction?.status || '');
  
  return (
    <div className="auction-card">
      {isResultMode ? renderResultMode() : renderActiveMode()}
    </div>
  );
};

export default AuctionCard;
