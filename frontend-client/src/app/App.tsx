import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import AuctionPage from '../page/AuctionPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" richColors />
      <Routes>
        <Route path="/" element={<AuctionPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
