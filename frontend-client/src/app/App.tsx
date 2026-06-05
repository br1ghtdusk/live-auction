import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AuctionPage from '../page/AuctionPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AuctionPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
