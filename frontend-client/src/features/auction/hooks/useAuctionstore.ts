import { useContext } from 'react';
import { AuctionContext } from '../store/auction.store';


export const useAuctionStore = () => {
  const context = useContext(AuctionContext);
  if (!context) {
    throw new Error('useAuctionStore must be used within AuctionProvider');
  }
  return context;
};