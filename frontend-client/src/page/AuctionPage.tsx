import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AuctionProvider } from '../features/auction/store/auction.store';
import { useAuctionStore } from '../features/auction/hooks/useAuctionstore';
import AuctionCard from '../features/auction/components/AuctionCard';
import { LeaderboardDrawer } from '../features/auction/components/LeaderboardDrawer';
import { ExtensionAlert } from '../features/auction/components/ExtensionAlert';
import './AuctionPage.css';

// ============ 子组件：视频背景 ============
const VideoBackground = () => {
  return (
    <video
      autoPlay
      loop
      muted
      playsInline
      className="video-background"
    >
      <source
        src="https://www.w3schools.com/html/mov_bbb.mp4"
        type="video/mp4"
      />
    </video>
  );
};

// ============ 子组件：出价弹幕容器 ============
const BidBarrageContainer = () => {
  const { bidsList } = useAuctionStore();

  return (
    <div className="bid-barrage-container">
      {bidsList.slice(0, 10).map((bid: any) => (
        <div key={bid.id} className="bid-barrage-item">
          <span className="barrage-user">👤 用户{bid.userId}</span>
          <span className="barrage-price">¥{bid.amount}.00</span>
        </div>
      ))}
    </div>
  );
};

// ============ 子组件：排行榜按钮 ============
const LeaderboardButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <button
      className="leaderboard-button"
      onClick={onClick}
    >
      🏆 排行榜
    </button>
  );
};

// ============ 内容组件：真正的页面主体 ============
function AuctionPageBody() {
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const { loadLeaderboard } = useAuctionStore();

  const handleLeaderboardClick = () => {
    loadLeaderboard();
    setIsLeaderboardOpen(true);
  };

  return (
    <div className="auction-page-container">
      <VideoBackground />
      <ExtensionAlert />
      <BidBarrageContainer />
      <LeaderboardButton onClick={handleLeaderboardClick} />
      <div className="auction-card-wrapper">
        <AuctionCard />
      </div>
      
      {/* 排行榜抽屉 */}
      <LeaderboardDrawer 
        isOpen={isLeaderboardOpen} 
        onClose={() => setIsLeaderboardOpen(false)} 
      />
    </div>
  );
}

// ============ 入口组件：只负责参数解析和 Provider 挂载 ============
export default function AuctionPage() {
  const [searchParams] = useSearchParams();
  
  // 生成用户ID
  const myUserId = useRef(Math.floor(Math.random() * 9999) + 1000).current;
  
  // 获取房间ID
  const roomId = Number(searchParams.get('roomId')) || 101;

  return (
    <AuctionProvider myUserId={myUserId} roomId={roomId}>
      <AuctionPageBody />
    </AuctionProvider>
  );
}