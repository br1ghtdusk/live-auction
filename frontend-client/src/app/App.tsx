import { AuctionCard } from '../features/auction/components/AuctionCard';
import { getStoredUserId } from '../hooks/useLocalStorage';
import './App.css';
import '../features/auction/components/AuctionCard.css';

function App() {
  // 从 URL 参数获取 roomId，默认 101
  const searchParams = new URLSearchParams(window.location.search);
  const roomId = searchParams.get('roomId') || '101';
  const WS_URL = `ws://localhost:8081?roomId=${roomId}`;
  const MY_USER_ID = getStoredUserId();

  return (
    <AuctionCard
      wsUrl={WS_URL}
      myUserId={MY_USER_ID}
    />
  );
}

export default App;