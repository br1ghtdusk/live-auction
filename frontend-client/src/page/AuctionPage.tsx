import { useRef, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AuctionProvider } from '../features/auction/store/auction.store';
import { useAuctionStore } from '../features/auction/hooks/useAuctionstore';
import AuctionCard from '../features/auction/components/AuctionCard';
import { ExtensionAlert } from '../features/auction/components/ExtensionAlert';
import { HeartEffect } from '../components/HeartEffect';
import { RoomListDrawer } from '../features/auction/components/RoomListDrawer';
import { getStoredUserId } from '../hooks/useLocalStorage';
import './AuctionPage.css';

// ============ 子组件：视频背景 ============
const VideoBackground = () => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(err => {
        console.warn('视频自动播放被拦截，正在尝试重试...', err);
      });
    }
  }, []);

  return (
    <video
      ref={videoRef}
      autoPlay
      loop
      muted
      playsInline
      className="video-background"
      style={{ pointerEvents: 'none' }}
      src="https://media.w3.org/2010/05/sintel/trailer.mp4"
    />
  );
};

// ============ 子组件：出价弹幕容器 ============
const BidBarrageContainer = () => {
  const store = useAuctionStore();
  const bidsList = store?.bidsList || [];

  return (
    <div className="bid-barrage-container">
      {Array.isArray(bidsList) && bidsList.slice(0, 10).map((bid: any) => (
        <div key={bid.id || Math.random()} className="bid-barrage-item">
          <span className="barrage-user">👤 用户{bid.userId}</span>
          <span className="barrage-price">¥{bid.amount}.00</span>
        </div>
      ))}
    </div>
  );
};

// ============ 内容组件：真正的页面主体 ============
function AuctionPageBody() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [isRoomListOpen, setIsRoomListOpen] = useState(false);
  const store = useAuctionStore();
  const roomId = Number(searchParams.get('roomId')) || 101;
  const roomName = store?.roomName || '加载中...';

  const handleSwitchRoom = (newRoomId: number) => {
    setSearchParams({ roomId: newRoomId.toString() });
  };

  return (
    <div ref={containerRef} className="auction-page-container noise-overlay">
      <VideoBackground />
      
      {/* 顶部交互层 */}
      <div className="page-header-actions">
        <button 
          className="rooms-trigger-btn"
          onClick={() => setIsRoomListOpen(true)}
        >
          <span className="rooms-icon">📡</span>
          {roomName}
        </button>
      </div>

      <ExtensionAlert />
      <HeartEffect containerRef={containerRef} />
      <BidBarrageContainer />
      <div className="auction-card-wrapper">
        <AuctionCard />
      </div>

      <RoomListDrawer 
        isOpen={isRoomListOpen}
        onClose={() => setIsRoomListOpen(false)}
        currentRoomId={roomId}
        onSwitchRoom={handleSwitchRoom}
      />
    </div>
  );
}

// ============ 入口组件：只负责参数解析和 Provider 挂载 ============
export default function AuctionPage() {
  const [searchParams] = useSearchParams();
  
  // 使用 localStorage 持久化用户ID
  const myUserId = getStoredUserId();
  
  // 获取房间ID
  const roomId = Number(searchParams.get('roomId')) || 101;

  return (
    <AuctionProvider myUserId={myUserId} roomId={roomId}>
      <AuctionPageBody />
    </AuctionProvider>
  );
}
