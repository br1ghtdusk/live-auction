import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image, PartyPopper, XCircle, Frown } from 'lucide-react';
import { useAuctionStatus } from '../hooks/useAuctionStatus';
import { CountdownTimer } from './CountdownTimer';
import { PricePanel } from './PricePanel';
import { BidPanel } from './BidPanel';
import Payment from './Payment';
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
    bidderCount,
    leaderboardList,
    loadLeaderboard,
  } = useAuctionStore();

  const [isExpanded, setIsExpanded] = useState(true);

  // 当展开时自动刷新排行榜
  useEffect(() => {
    if (isExpanded && auction?.id) {
      loadLeaderboard();
    }
  }, [isExpanded, auction?.id]);
  const displayStatus = useAuctionStatus(auction);
  const isWinning = auction?.highest_bidder_id === myUserId;

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
          <span className="idle-subtitle">主播正在准备商品...</span>
          <span className="idle-hint">✨ 下一件宝贝即将登场，敬请期待！</span>
        </div>
      </div>
    );
  }

  // 活动模式渲染
  const renderActiveMode = () => (
    <div className={`auction-card-content ${isWinning ? 'is-winning' : ''}`}>
      {isWinning && <div className="winning-glow" />}
      
      {/* 状态栏：无论展开还是收起都显示 */}
      <div className="card-top-bar" onClick={() => setIsExpanded(!isExpanded)} style={{ cursor: 'pointer' }}>
        <div className="flex items-center gap-4">
          <div className="live-indicator connected">
            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-success shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-red-500'}`} />
            <span className="font-black tabular">直播中</span>
            </div>
            {!isExpanded && (
             <div className="flex items-center">
               <div className="collapsed-info-item">
                 <span className="info-label">当前价</span>
                 <span className="info-value primary tabular">{formatPrice(auction?.current_price || 0)}</span>
               </div>
               {isWinning && (
                 <div className="collapsed-info-item">
                   <span className="info-value success">领先</span>
                 </div>
               )}
             </div>
            )}
            </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-white/40">参拍人数</span>
            <span className="text-white font-black tabular">{bidderCount}</span>
          </div>
          <span className="user-id-mini">ID: {myUserId}</span>
          <motion.div 
            animate={{ rotate: isExpanded ? 0 : 180 }}
            className="toggle-icon"
          >
            ▼
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="expandable-content"
          >
            {/* 商品图片 + 倒计时 */}
            <div className="card-image-wrapper">
              {auction?.image_url ? (
                <img
                  src={auction.image_url}
                  alt={auction.name || '拍品'}
                  className="card-image"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).parentElement?.classList.add('is-missing');
                  }}
                />
              ) : (
                <div className="image-placeholder">
                  <Image className="w-12 h-12 text-muted opacity-30" />
                  <span className="placeholder-text">暂无拍品图片</span>
                </div>
              )}
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

              {/* 集成排行榜列表 */}
              <div className="card-leaderboard-section">
                <div className="section-header">
                  <span className="section-label">实时榜单 TOP 3</span>
                </div>
                <div className="compact-leaderboard">
                  {leaderboardList.length > 0 ? (
                    leaderboardList.slice(0, 3).map((item, index) => (
                      <div key={item.userId} className="compact-rank-item">
                        <div className={`rank-dot rank-${index + 1}`}>
                          {index + 1}
                        </div>
                        <span className="rank-name">{item.username}</span>
                        <span className="rank-price">{formatPrice(item.maxBidAmount)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="empty-rank">暂无出价记录</div>
                  )}
                </div>
              </div>

              <BidPanel
                currentPrice={auction?.current_price || 0}
                bidIncrement={auction?.bid_increment || 0}
                canBid={displayStatus?.canBid || false}
                isSubmitting={isSubmitting}
                onBid={(amount) => {
                  if (displayStatus?.canBid) {
                    submitBid(amount);
                  }
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // 结果模式渲染
  const renderResultMode = () => (
    <div className="auction-card-content result-mode">
      {/* 状态栏 */}
      <div className="card-top-bar" onClick={() => setIsExpanded(!isExpanded)} style={{ cursor: 'pointer' }}>
        <div className="flex items-center gap-4">
          <div className="live-indicator">
            <div className="w-1.5 h-1.5 rounded-full bg-muted" />
            <span className="font-black tabular">竞拍结束</span>
          </div>
          {!isExpanded && (
             <div className="collapsed-info-item">
               <span className="info-label">最终价</span>
               <span className="info-value success tabular">{formatPrice(auction?.current_price || 0)}</span>
             </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <motion.div 
            animate={{ rotate: isExpanded ? 0 : 180 }}
            className="toggle-icon"
          >
            ▼
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="expandable-content"
          >
            {/* 🌟 结果状态区 - 固定在顶部，不被裁剪 */}
            <div className="result-overlay">
              <div className="result-content">
                {auction?.status === 'SOLD' ? (
                  <>
                    <PartyPopper className="w-12 h-12 text-success animate-bounce" />
                    <span className="result-title">成交</span>
                  </>
                ) : auction?.status === 'CANCELLED' ? (
                  <>
                    <XCircle className="w-12 h-12 text-muted" />
                    <span className="result-title">已取消</span>
                  </>
                ) : (
                  <>
                    <Frown className="w-12 h-12 text-muted" />
                    <span className="result-title">流拍</span>
                  </>
                )}
              </div>
            </div>

            {/* 🌟 结果信息区 - 独立布局，避免拥挤 */}
            <div className="result-body">
              {/* 商品名称 */}
              <h2 className="card-title">{auction?.name || '未命名拍品'}</h2>

              {/* 成交价格 */}
              <div className="result-price-section">
                <span className="result-label">
                  {auction?.status === 'SOLD' ? '成交价' : '最终价'}
                </span>
                <span className={`result-value ${auction?.status === 'SOLD' ? 'sold' : ''}`}>
                  {formatPrice(auction?.current_price || 0)}
                </span>
              </div>

              {/* 获胜者勋章 */}
              {auction?.status === 'SOLD' && auction?.highest_bidder_id && (
                <div className="winner-section">
                  <span className="winner-badge">🏆 获胜者</span>
                  <span className="winner-id">用户 {auction.highest_bidder_id}</span>
                </div>
              )}

              {/* 支付组件 */}
              <Payment />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
