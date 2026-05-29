import { AuctionCard } from '../features/auction/components/AuctionCard';
import { getStoredUserId } from '../hooks/useLocalStorage';
import './App.css';
import '../features/auction/components/AuctionCard.css';

function App() {
  const WS_URL = 'ws://localhost:8081?roomId=room_1';
  const MY_USER_ID = getStoredUserId();

  return (
    <AuctionCard
      wsUrl={WS_URL}
      myUserId={MY_USER_ID}
    />
  );
}

export default App;