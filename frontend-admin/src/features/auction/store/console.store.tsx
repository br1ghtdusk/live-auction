import { createContext, useContext, useCallback, useState, type ReactNode } from 'react';

// ============ 类型定义 ============

export type RoomDisplayMode = 'ACTIVE' | 'RESULT' | 'IDLE';

export interface BidRecord {
  id: number;
  userId: number;
  amount: number;
  time: string;
}

export interface CurrentAuction {
  id: string | number;
  name: string;
  current_price: number;
  status: 'BIDDING' | 'WAITING' | 'SOLD' | 'FAILED' | 'CANCELLED';
  scheduled_start_time: number;
  scheduled_end_time: number;
  highest_bidder_id?: number;
  image_url?: string | null;
  bid_increment?: number;
  ceiling_price?: number;
  extend_count?: number;
  cancel_reason?: string;
}

export interface ConsoleState {
  roomDisplayMode: RoomDisplayMode;
  currentAuction: CurrentAuction | null;
  bidsList: BidRecord[];
}

export interface ConsoleActions {
  setRoomDisplay: (mode: RoomDisplayMode, auction: CurrentAuction | null) => void;
  initBidsList: (bids: BidRecord[]) => void;
  appendNewBid: (bid: BidRecord) => void;
  resetStore: () => void;
}

export type ConsoleStore = ConsoleState & ConsoleActions;

// ============ Context 创建 ============

const ConsoleContext = createContext<ConsoleStore | null>(null);

// ============ Provider 组件 ============

interface ConsoleProviderProps {
  children: ReactNode;
}

export function ConsoleProvider({ children }: ConsoleProviderProps) {
  const [roomDisplayMode, setRoomDisplayMode] = useState<RoomDisplayMode>('IDLE');
  const [currentAuction, setCurrentAuction] = useState<CurrentAuction | null>(null);
  const [bidsList, setBidsList] = useState<BidRecord[]>([]);

  // 更新展示模式和当前拍品
  const setRoomDisplay = useCallback((mode: RoomDisplayMode, auction: CurrentAuction | null) => {
    setRoomDisplayMode(mode);
    setCurrentAuction(auction);
  }, []);

  // 用后端 API 历史数据初始化出价列表
  const initBidsList = useCallback((bids: BidRecord[]) => {
    // 后端返回的是时间升序，前端需要展示时间降序（最新在前）
    const sortedBids = [...bids].reverse();
    setBidsList(sortedBids);
  }, []);

  // 将 WebSocket 推送的新出价追加到列表头部
  const appendNewBid = useCallback((bid: BidRecord) => {
    setBidsList((prev) => [bid, ...prev].slice(0, 50)); // 最多保留50条
  }, []);

  // 重置 store（切换房间时调用）
  const resetStore = useCallback(() => {
    setRoomDisplayMode('IDLE');
    setCurrentAuction(null);
    setBidsList([]);
  }, []);

  const store: ConsoleStore = {
    roomDisplayMode,
    currentAuction,
    bidsList,
    setRoomDisplay,
    initBidsList,
    appendNewBid,
    resetStore,
  };

  return (
    <ConsoleContext.Provider value={store}>
      {children}
    </ConsoleContext.Provider>
  );
}

// ============ 自定义 Hook ============

export function useConsoleStore(): ConsoleStore {
  const context = useContext(ConsoleContext);
  if (!context) {
    throw new Error('useConsoleStore must be used within ConsoleProvider');
  }
  return context;
}
