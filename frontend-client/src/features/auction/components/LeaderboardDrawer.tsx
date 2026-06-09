import React from 'react';
import { useAuctionStore } from '../hooks/useAuctionstore';
import { formatPrice } from '../../../shared/utils/formatPrice';
import './LeaderboardDrawer.css';

interface LeaderboardDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LeaderboardDrawer: React.FC<LeaderboardDrawerProps> = React.memo(({
  isOpen,
  onClose,
}) => {
  const { leaderboardList } = useAuctionStore();

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getRankStyle = (index: number) => {
    switch (index) {
      case 0:
        return 'rank-gold';
      case 1:
        return 'rank-silver';
      case 2:
        return 'rank-bronze';
      default:
        return 'rank-default';
    }
  };

  const getRankBadge = (index: number) => {
    switch (index) {
      case 0:
        return '🥇';
      case 1:
        return '🥈';
      case 2:
        return '🥉';
      default:
        return `#${index + 1}`;
    }
  };

  if (!isOpen) return null;

  // 安全检查：确保 leaderboardList 是有效的数组
  const safeList = Array.isArray(leaderboardList) ? leaderboardList : [];

  return (
    <div className="leaderboard-overlay" onClick={handleOverlayClick}>
      <div className="leaderboard-drawer">
        {/* 头部 */}
        <div className="leaderboard-header">
          <h2 className="leaderboard-title">🏆 竞拍龙虎榜</h2>
          <button className="close-button" onClick={onClose}>
            ❌
          </button>
        </div>

        {/* 列表内容 */}
        <div className="leaderboard-content">
          {safeList.length === 0 ? (
            <div className="empty-state">
              ✨ 暂无出价记录，快来抢占榜首吧！
            </div>
          ) : (
            <ul className="leaderboard-list">
              {safeList.map((item, index) => {
                // 安全获取用户信息
                const userId = item?.userId ?? 0;
                const username = item?.username ?? `用户${userId}`;
                const bidCount = item?.bidCount ?? 0;
                const maxBidAmount = item?.maxBidAmount ?? 0;

                return (
                  <li key={userId || `item-${index}`} className="leaderboard-item">
                    {/* 排名 */}
                    <span className={`rank-badge ${getRankStyle(index)}`}>
                      {getRankBadge(index)}
                    </span>

                    {/* 昵称 */}
                    <span className="user-name">{username}</span>

                    {/* 出价次数 */}
                    <span className="bid-count">
                      出价{bidCount}次
                    </span>

                    {/* 最高出价 */}
                    <span className="max-bid">
                      {formatPrice(maxBidAmount)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
});

LeaderboardDrawer.displayName = 'LeaderboardDrawer';