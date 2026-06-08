import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Flame, AlertCircle, PartyPopper } from 'lucide-react';
import type { Auction } from '../types/auction.types';
import { auctionApi } from '../services/auction.api';
import { sanitizeAuctionData } from '../utils/sanitizeAuction';

// ============ 类型定义 ============

export type RoomDisplayMode = 'ACTIVE' | 'RESULT' | 'IDLE';

export interface BidRecord {
  id: number;
  userId: number;
  amount: number;
  time: string;
}

export interface LeaderboardItem {
  userId: number;
  username: string;
  avatar: string;
  maxBidAmount: number;  // 最高出价（分）
  bidCount: number;      // 出价次数
}

export type PaymentStatus = 'pending' | 'paying' | 'paid' | 'timeout';

export interface ConsoleState {
  roomDisplayMode: RoomDisplayMode;
  roomName: string;
  currentAuction: Auction | null;
  bidsList: BidRecord[];
  leaderboardList: LeaderboardItem[];
  bidderCount: number;
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  isSubmitting: boolean;
  myUserId: number;
  // 延时提醒相关
  showExtensionAlert: boolean;
  extensionSeconds: number;
  alertTrigger: number;  // 用于解决连续弹窗被吞的 Bug
  // 支付状态
  paymentStatus: PaymentStatus;
}

export interface ConsoleActions {
  setRoomDisplay: (mode: RoomDisplayMode, auction: Auction | null) => void;
  initBidsList: (bids: BidRecord[]) => void;
  appendNewBid: (bid: BidRecord) => void;
  setLeaderboard: (list: LeaderboardItem[]) => void;
  setBidderCount: (count: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setConnected: (connected: boolean) => void;
  setSubmitting: (submitting: boolean) => void;
  setExtensionAlert: (show: boolean, seconds?: number) => void;
  resetStore: () => void;
  submitBid: (bidAmount: number) => void;
  loadLeaderboard: () => Promise<void>;
  setPaymentStatus: (status: PaymentStatus) => void;
  resetPaymentStatus: () => void;
  resetAuctionData: () => void;
  payOrder: (auctionId: number, userId: number) => Promise<boolean>;
}

export type ConsoleStore = ConsoleState & ConsoleActions;

// ============ Context 创建 ============

const initialState: ConsoleState = {
  roomDisplayMode: 'IDLE',
  roomName: '加载中...',
  currentAuction: null,
  bidsList: [],
  leaderboardList: [],
  bidderCount: 0,
  loading: true,
  error: null,
  isConnected: false,
  isSubmitting: false,
  myUserId: 0,
  // 延时提醒相关
  showExtensionAlert: false,
  extensionSeconds: 0,
  alertTrigger: 0,
  // 支付状态
  paymentStatus: 'pending',
};

export const AuctionContext = createContext<ConsoleStore | null>(null);

// ============ 环境变量 ============

// 🌟 动态获取 WebSocket 地址，强制使用后端8081端口
const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
const WS_URL = `${protocol}${window.location.hostname}:8081`;

// ============ Provider 组件 ============

interface AuctionProviderProps {
  children: ReactNode;
  myUserId: number;
  roomId: number;
}

export const AuctionProvider = ({ children, myUserId, roomId }: AuctionProviderProps) => {
  const [roomDisplayMode, setRoomDisplayMode] = useState(initialState.roomDisplayMode);
  const [roomName, setRoomName] = useState(initialState.roomName);
  const [currentAuction, setCurrentAuction] = useState(initialState.currentAuction);
  const [bidsList, setBidsList] = useState(initialState.bidsList);
  const [leaderboardList, setLeaderboardList] = useState(initialState.leaderboardList);
  const [bidderCount, setBidderCount] = useState(initialState.bidderCount);
  const [loading, setLoading] = useState(initialState.loading);
  const [error, setError] = useState(initialState.error);
  const [isConnected, setConnected] = useState(initialState.isConnected);
  const [isSubmitting, setSubmitting] = useState(initialState.isSubmitting);
  
  // 延时提醒状态
  const [showExtensionAlert, setShowExtensionAlert] = useState(initialState.showExtensionAlert);
  const [extensionSeconds, setExtensionSeconds] = useState(initialState.extensionSeconds);
  const [alertTrigger, setAlertTrigger] = useState(initialState.alertTrigger);
  
  // 支付状态
  const [paymentStatus, setPaymentStatusState] = useState(initialState.paymentStatus);
  const paymentStatusRef = useRef(initialState.paymentStatus);
  const auctionIdRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    paymentStatusRef.current = paymentStatus;
  }, [paymentStatus]);

  // 🌟 核心逻辑：当 auctionId 变化时自动重置
  useEffect(() => {
    const prevAuctionId = auctionIdRef.current;
    const currentAuctionId = currentAuction?.id;
    
    if (prevAuctionId !== currentAuctionId) {
      if (prevAuctionId !== undefined) {
        setBidsList([]);
        setLeaderboardList([]);
        setBidderCount(0);
      }
      if (currentAuctionId !== undefined) {
        setPaymentStatusState('pending');
      }
      auctionIdRef.current = currentAuctionId;
    }
  }, [currentAuction?.id]);

  const setRoomDisplay = useCallback((mode: RoomDisplayMode, auction: Auction | null) => {
    setRoomDisplayMode(mode);
    setCurrentAuction(auction);
  }, []);

  const initBidsList = useCallback((bids: BidRecord[]) => {
    const sortedBids = [...bids].reverse();
    setBidsList(sortedBids);
  }, []);

  const appendNewBid = useCallback((bid: BidRecord) => {
    setBidsList((prev) => [bid, ...prev].slice(0, 50));
  }, []);

  const setLeaderboard = useCallback((list: LeaderboardItem[]) => {
    setLeaderboardList(list);
  }, []);

  const setBidderCountAction = useCallback((count: number) => {
    setBidderCount(count);
  }, []);

  const resetStore = useCallback(() => {
    setRoomDisplayMode(initialState.roomDisplayMode);
    setRoomName(initialState.roomName);
    setCurrentAuction(initialState.currentAuction);
    setBidsList(initialState.bidsList);
    setLeaderboardList(initialState.leaderboardList);
    setBidderCount(initialState.bidderCount);
    setLoading(initialState.loading);
    setError(initialState.error);
    setConnected(initialState.isConnected);
    setSubmitting(initialState.isSubmitting);
    setShowExtensionAlert(initialState.showExtensionAlert);
    setExtensionSeconds(initialState.extensionSeconds);
    setAlertTrigger(initialState.alertTrigger);
    setPaymentStatusState(initialState.paymentStatus);
  }, []);

  const setExtensionAlert = useCallback((show: boolean, seconds?: number) => {
    setShowExtensionAlert(show);
    if (seconds !== undefined) setExtensionSeconds(seconds);
    if (show) setAlertTrigger(Date.now());
  }, []);

  const setPaymentStatus = useCallback((status: PaymentStatus) => {
    setPaymentStatusState(status);
  }, []);

  const resetPaymentStatus = useCallback(() => {
    setPaymentStatusState('pending');
  }, []);

  const resetAuctionData = useCallback(() => {
    setBidsList([]);
    setLeaderboardList([]);
    setBidderCount(0);
  }, []);

  const payOrder = useCallback(async (auctionId: number, userId: number): Promise<boolean> => {
    if (paymentStatusRef.current === 'paying') return false;
    if (paymentStatusRef.current === 'paid') {
      toast.success('该商品已完成支付', { icon: <PartyPopper className="w-5 h-5 text-green-500" /> });
      return true;
    }

    setPaymentStatusState('paying');
    try {
      const result = await auctionApi.payOrder(auctionId, userId);
      if (result.success) {
        toast.success('正在确认支付...');
        return true;
      } else {
        setPaymentStatusState('pending');
        toast.error(result.message || '支付失败');
        return false;
      }
    } catch (err) {
      setPaymentStatusState('pending');
      toast.error('支付请求失败');
      return false;
    }
  }, []);

  const loadAuctionData = useCallback(async (auctionId: number) => {
    try {
      const res = await auctionApi.getBidHistory(auctionId);
      if (res.code === 0 || res.code === 200) initBidsList(res.data);
    } catch (err) {
      console.error('加载拍卖数据失败:', err);
    }
  }, [initBidsList]);

  const wsRef = useRef<WebSocket | null>(null);
  const bidTimeoutRef = useRef<number | null>(null);
  const currentAuctionRef = useRef<Auction | null>(null);
  const leaderboardLoadingRef = useRef(false);
  const lastSyncTimeRef = useRef<number>(0);
  const reconnectDelayRef = useRef<number>(1000);

  useEffect(() => {
    currentAuctionRef.current = currentAuction;
  }, [currentAuction]);

  const loadLeaderboard = useCallback(async () => {
    const auction = currentAuctionRef.current;
    if (!auction || leaderboardLoadingRef.current) return;
    leaderboardLoadingRef.current = true;
    try {
      const res = await auctionApi.getAuctionLeaderboard(auction.id);
      if (res.code === 0 || res.code === 200) {
        setLeaderboard(res.data.list);
        setBidderCount(res.data.bidderCount);
      }
    } catch (err) {
      console.error('获取排行榜失败:', err);
    } finally {
      leaderboardLoadingRef.current = false;
    }
  }, [setLeaderboard]);

  const submitBid = useCallback((bidAmount: number) => {
    if (!currentAuctionRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    setSubmitting(true);
    if (bidTimeoutRef.current) clearTimeout(bidTimeoutRef.current);
    bidTimeoutRef.current = window.setTimeout(() => setSubmitting(false), 3000);

    wsRef.current.send(JSON.stringify({
      action: 'bid',
      auctionId: currentAuctionRef.current.id,
      bidAmount: bidAmount,
      userId: myUserId,
    }));
  }, [myUserId, setSubmitting]);

  const fetchCurrentAuction = useCallback(async () => {
    try {
      const res = await auctionApi.getRoomDisplayState(roomId);
      if (res.code === 0 || res.code === 200) {
        const { mode, auction, bidderCount, roomName } = res.data;
        const cleanedAuction = auction ? sanitizeAuctionData(auction) : null;
        setRoomDisplayMode(mode);
        if (roomName) setRoomName(roomName);
        setCurrentAuction(cleanedAuction);
        if (bidderCount !== undefined) setBidderCount(bidderCount);
        setLoading(false);
        lastSyncTimeRef.current = Date.now();
        if (cleanedAuction) {
          loadAuctionData(cleanedAuction.id);
          loadLeaderboard();
        }
      }
    } catch (err) {
      console.error('拉取当前拍卖状态失败:', err);
    }
  }, [roomId, loadAuctionData, loadLeaderboard]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[WS] Received message:', data.type, data.data);

        switch (data.type) {
          case 'room_display': {
            const { mode, auction, bidderCount, roomName } = data.data;
            const cleanedAuction = auction ? sanitizeAuctionData(auction) : null;
            setRoomDisplayMode(mode);
            if (roomName) setRoomName(roomName);
            setCurrentAuction(cleanedAuction);
            if (bidderCount !== undefined) setBidderCount(bidderCount);
            setLoading(false);
            lastSyncTimeRef.current = Date.now();
            if (cleanedAuction) {
              loadAuctionData(cleanedAuction.id);
              loadLeaderboard();
            }
            break;
          }

          case 'price_update': {
            if (bidTimeoutRef.current) {
              clearTimeout(bidTimeoutRef.current);
              bidTimeoutRef.current = null;
            }
            setSubmitting(false);
            const priceData = data.data;
            if (priceData.bidderCount !== undefined) setBidderCount(priceData.bidderCount);
            if (priceData.leaderboardList) setLeaderboard(priceData.leaderboardList);

            const wasIWinning = currentAuctionRef.current?.highest_bidder_id === myUserId;
            const amIWinningNow = priceData.highestBidderId === myUserId;

            if (wasIWinning && !amIWinningNow && myUserId !== 0) {
              toast.error('您已被超越！', { 
                description: `当前最高价已更新至 ¥${(priceData.currentPrice / 100).toFixed(2)}`,
                icon: <Flame className="w-5 h-5 text-orange-500 animate-pulse" />,
                duration: 5000
              });
            } else if (amIWinningNow) {
              toast.success('出价成功！您目前暂时领先');
            }

            const newBid: BidRecord = {
              id: Date.now(),
              userId: priceData.highestBidderId,
              amount: Math.round(priceData.currentPrice / 100),
              time: new Date().toLocaleTimeString(),
            };
            setBidsList((prev) => [newBid, ...prev].slice(0, 50));
            
            setCurrentAuction((prev) => {
              if (!prev) return null;
              const updated = {
                ...prev,
                current_price: priceData.currentPrice,
                highest_bidder_id: priceData.highest_bidder_id,
                scheduled_end_time: priceData.endTime ?? prev.scheduled_end_time,
                extend_count: priceData.extendCount ?? prev.extend_count,
              };
              currentAuctionRef.current = updated;
              return updated;
            });
            break;
          }

          case 'leaderboard_update': {
            const { list, bidderCount } = data.data;
            if (list) setLeaderboard(list);
            if (bidderCount !== undefined) setBidderCount(bidderCount);
            break;
          }

          case 'bid_rejected': {
            if (bidTimeoutRef.current) {
              clearTimeout(bidTimeoutRef.current);
              bidTimeoutRef.current = null;
            }
            setSubmitting(false);
            break;
          }

          case 'EXTENSION': {
            const extData = data.data;
            setExtensionAlert(true, extData.extendSeconds);
            setCurrentAuction((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                scheduled_end_time: extData.newEndTime,
                extend_count: prev.extend_count + 1,
              };
            });
            break;
          }

          case 'AUCTION_PAID': {
            setPaymentStatusState('paid');
            if (myUserId === data.data.winnerId) {
              toast.success('支付成功！商品正在打包中', {
                description: `成交价 ¥${(data.data.price / 100).toFixed(2)}`,
                icon: <PartyPopper className="w-5 h-5 text-green-500" />,
                duration: 5000,
              });
            }
            break;
          }

          case 'AUCTION_PAYMENT_TIMEOUT': {
            setPaymentStatusState('timeout');
            toast.error('支付超时，商品已流拍', {
              description: data.data.message || '请联系客服',
              icon: <AlertCircle className="w-5 h-5 text-red-500" />,
              duration: 5000,
            });
            break;
          }
        }
      } catch (e) {
        console.error('消息解析错误:', e);
      }
    };

    const createConnection = () => {
      if (wsRef.current?.readyState !== WebSocket.CLOSED) wsRef.current?.close();
      setLoading(true);
      const sanitizedWsUrl = `${WS_URL}/?roomId=${roomId}`.replace(/\/+\?/, '/?');
      const ws = new WebSocket(sanitizedWsUrl);
      
      ws.onopen = () => {
        setConnected(true);
        setError(null);
        reconnectDelayRef.current = 1000;
        fetchCurrentAuction();
      };
      
      ws.onclose = (e) => {
        setConnected(false);
        const delay = reconnectDelayRef.current;
        setTimeout(() => createConnection(), delay);
        reconnectDelayRef.current = Math.min(delay * 2, 16000);
      };
      
      ws.onerror = (event) => console.error('[WS] ERROR', event);
      ws.onmessage = handleMessage;
      wsRef.current = ws;
    };

    createConnection();

    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      if (bidTimeoutRef.current) clearTimeout(bidTimeoutRef.current);
    };
  }, [roomId, fetchCurrentAuction, loadAuctionData, loadLeaderboard, myUserId]);

  const store: ConsoleStore = {
    roomDisplayMode, roomName, currentAuction, bidsList, leaderboardList, bidderCount,
    loading, error, isConnected, isSubmitting, myUserId, showExtensionAlert,
    extensionSeconds, alertTrigger, paymentStatus, setRoomDisplay, initBidsList,
    appendNewBid, setLeaderboard, setBidderCount: setBidderCountAction, setLoading,
    setError, setConnected, setSubmitting, setExtensionAlert, resetStore, submitBid,
    loadLeaderboard, setPaymentStatus, resetPaymentStatus, resetAuctionData, payOrder,
  };

  return (
    <AuctionContext.Provider value={store}>
      {children}
    </AuctionContext.Provider>
  );
};
