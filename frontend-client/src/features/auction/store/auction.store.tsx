import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
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

export interface ConsoleState {
  roomDisplayMode: RoomDisplayMode;
  currentAuction: Auction | null;
  bidsList: BidRecord[];
  leaderboardList: LeaderboardItem[];
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  isSubmitting: boolean;
  myUserId: number;
  // 延时提醒相关
  showExtensionAlert: boolean;
  extensionSeconds: number;
  alertTrigger: number;  // 用于解决连续弹窗被吞的 Bug
}

export interface ConsoleActions {
  setRoomDisplay: (mode: RoomDisplayMode, auction: Auction | null) => void;
  initBidsList: (bids: BidRecord[]) => void;
  appendNewBid: (bid: BidRecord) => void;
  setLeaderboard: (list: LeaderboardItem[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setConnected: (connected: boolean) => void;
  setSubmitting: (submitting: boolean) => void;
  setExtensionAlert: (show: boolean, seconds?: number) => void;
  resetStore: () => void;
  submitBid: (bidAmount: number) => void;
  loadLeaderboard: () => Promise<void>;
}

export type ConsoleStore = ConsoleState & ConsoleActions;

// ============ Context 创建 ============

const initialState: ConsoleState = {
  roomDisplayMode: 'IDLE',
  currentAuction: null,
  bidsList: [],
  leaderboardList: [],
  loading: true,
  error: null,
  isConnected: false,
  isSubmitting: false,
  myUserId: 0,
  // 延时提醒相关
  showExtensionAlert: false,
  extensionSeconds: 0,
  alertTrigger: 0,
};

export const AuctionContext = createContext<ConsoleStore | null>(null);

// ============ 环境变量 ============

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8081';

// ============ Provider 组件 ============

interface AuctionProviderProps {
  children: ReactNode;
  myUserId: number;
  roomId: number;
}

export const AuctionProvider = ({ children, myUserId, roomId }: AuctionProviderProps) => {
  const [roomDisplayMode, setRoomDisplayMode] = useState(initialState.roomDisplayMode);
  const [currentAuction, setCurrentAuction] = useState(initialState.currentAuction);
  const [bidsList, setBidsList] = useState(initialState.bidsList);
  const [leaderboardList, setLeaderboardList] = useState(initialState.leaderboardList);
  const [loading, setLoading] = useState(initialState.loading);
  const [error, setError] = useState(initialState.error);
  const [isConnected, setConnected] = useState(initialState.isConnected);
  const [isSubmitting, setSubmitting] = useState(initialState.isSubmitting);
  
  // 延时提醒状态
  const [showExtensionAlert, setShowExtensionAlert] = useState(initialState.showExtensionAlert);
  const [extensionSeconds, setExtensionSeconds] = useState(initialState.extensionSeconds);
  const [alertTrigger, setAlertTrigger] = useState(initialState.alertTrigger);

  // 更新展示模式和当前拍品
  const setRoomDisplay = useCallback((mode: RoomDisplayMode, auction: Auction | null) => {
    setRoomDisplayMode(mode);
    setCurrentAuction(auction);
  }, []);

  // 用后端 API 历史数据初始化出价列表
  const initBidsList = useCallback((bids: BidRecord[]) => {
    const sortedBids = [...bids].reverse();
    setBidsList(sortedBids);
  }, []);

  // 将 WebSocket 推送的新出价追加到列表头部
  const appendNewBid = useCallback((bid: BidRecord) => {
    setBidsList((prev) => [bid, ...prev].slice(0, 50));
  }, []);

  // 更新排行榜
  const setLeaderboard = useCallback((list: LeaderboardItem[]) => {
    setLeaderboardList(list);
  }, []);

  // 重置 store
  const resetStore = useCallback(() => {
    setRoomDisplayMode(initialState.roomDisplayMode);
    setCurrentAuction(initialState.currentAuction);
    setBidsList(initialState.bidsList);
    setLeaderboardList(initialState.leaderboardList);
    setLoading(initialState.loading);
    setError(initialState.error);
    setConnected(initialState.isConnected);
    setSubmitting(initialState.isSubmitting);
    setShowExtensionAlert(initialState.showExtensionAlert);
    setExtensionSeconds(initialState.extensionSeconds);
    setAlertTrigger(initialState.alertTrigger);
  }, []);

  // 设置延时提醒
  const setExtensionAlert = useCallback((show: boolean, seconds?: number) => {
    setShowExtensionAlert(show);
    if (seconds !== undefined) {
      setExtensionSeconds(seconds);
    }
    if (show) {
      // 使用时间戳作为触发器，确保连续多次延时时组件能重新渲染
      setAlertTrigger(Date.now());
    }
  }, []);

  // 加载拍卖数据（仅出价流水）
  const loadAuctionData = useCallback(async (auctionId: number) => {
    try {
      const bidHistoryRes = await auctionApi.getBidHistory(auctionId);
      if (bidHistoryRes.code === 0 || bidHistoryRes.code === 200) {
        // 后端已经返回元单位，无需再转换
        initBidsList(bidHistoryRes.data);
      }
    } catch (err) {
      console.error('加载拍卖数据失败:', err);
    }
  }, [initBidsList]);

  // ============ Refs（用于 WebSocket 消息处理，避免依赖数组膨胀）============
  const wsRef = useRef<WebSocket | null>(null);
  const bidTimeoutRef = useRef<number | null>(null);
  const currentAuctionRef = useRef<Auction | null>(null);
  const leaderboardLoadingRef = useRef(false);

  // 同步 currentAuction 到 ref
  useEffect(() => {
    currentAuctionRef.current = currentAuction;
  }, [currentAuction]);

  // 懒加载排行榜
  const loadLeaderboard = useCallback(async () => {
    const auction = currentAuctionRef.current;
    if (!auction) return;
    
    if (leaderboardLoadingRef.current) return;
    leaderboardLoadingRef.current = true;
    
    try {
      const res = await auctionApi.getAuctionLeaderboard(auction.id);
      if (res.code === 0 || res.code === 200) {
        // 直接使用后端返回的数据结构，无需转换
        setLeaderboard(res.data);
      }
    } catch (err) {
      console.error('获取排行榜失败:', err);
    } finally {
      leaderboardLoadingRef.current = false;
    }
  }, [setLeaderboard]);

  // 提交出价（通过 WebSocket）
  const submitBid = useCallback((bidAmount: number) => {
    if (!currentAuctionRef.current) {
      console.warn('没有当前拍品，无法出价');
      return;
    }

    // 检查 WebSocket 连接状态
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket 未连接，无法出价');
      setError('网络连接异常，请稍后重试');
      return;
    }

    setSubmitting(true);

    if (bidTimeoutRef.current) {
      clearTimeout(bidTimeoutRef.current);
    }

    bidTimeoutRef.current = window.setTimeout(() => {
      setSubmitting(false);
      console.warn('出价请求超时，请重试');
    }, 3000);

    wsRef.current.send(
      JSON.stringify({
        action: 'bid',
        auctionId: currentAuctionRef.current!.id,
        bidAmount: bidAmount,
        userId: myUserId,
      })
    );
  }, [myUserId, setSubmitting]);

  // ============ WebSocket 连接（依赖数组只有 roomId）============
  useEffect(() => {
    // 消息处理函数（使用闭包捕获最新的 state setters）
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'room_display': {
            const { mode, auction } = data.data;
            const cleanedAuction = auction ? sanitizeAuctionData(auction) : null;
            setRoomDisplayMode(mode);
            setCurrentAuction(cleanedAuction);
            setLoading(false); // 数据加载完成
            
            if (cleanedAuction) {
              loadAuctionData(cleanedAuction.id);
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
            const newBid: BidRecord = {
              id: Date.now(),
              userId: priceData.highestBidderId,
              amount: Math.round(priceData.currentPrice / 100),
              time: new Date().toLocaleTimeString(),
            };
            // 直接调用 setBidsList，避免依赖 appendNewBid
            setBidsList((prev) => [newBid, ...prev].slice(0, 50));
            
            // 同步更新当前拍品状态，确保价格与后端一致
            setCurrentAuction((prev) => {
              if (!prev) return null;
              const updated = {
                ...prev,
                current_price: priceData.currentPrice,
                highest_bidder_id: priceData.highestBidderId,
                scheduled_end_time: priceData.endTime ?? prev.scheduled_end_time,
                extend_count: priceData.extendCount ?? prev.extend_count,
              };
              // 立即同步 Ref，避免 React State 异步更新导致的竞态问题
              currentAuctionRef.current = updated;
              return updated;
            });
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
            
            // 1. 弹出延时提醒
            setExtensionAlert(true, extData.extendSeconds);
            
            // 2. 核心业务：真正延长拍品的倒计时
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
        }
      } catch (e) {
        console.error('消息解析错误:', e);
      }
    };

    // 初始化
    resetStore();
    setLoading(true);

    // WebSocket 连接（主要数据来源）
    const ws = new WebSocket(`${WS_URL}?roomId=${roomId}`);
    
    ws.onopen = () => {
      console.log('[WS] OPEN');
      setConnected(true);
      setError(null); // 连接成功时清除错误状态
    };
    
    ws.onclose = (e) => {
      console.log('[WS] CLOSE', {
        code: e.code,
        reason: e.reason,
        wasClean: e.wasClean,
      });
      setConnected(false);
    };
    
    ws.onerror = (event) => {
      console.error('[WS] ERROR', event);
      // 不直接设置全局错误状态，避免 StrictMode 假报错污染
    };
    
    ws.onmessage = handleMessage;
    wsRef.current = ws;

    // 清理函数：页面退出时关闭连接，防止内存泄漏
    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      if (bidTimeoutRef.current) {
        clearTimeout(bidTimeoutRef.current);
      }
    };
  }, [roomId]); // 依赖数组只有 roomId，确保 WebSocket 不会因业务状态变化而重连

  const store: ConsoleStore = {
    roomDisplayMode,
    currentAuction,
    bidsList,
    leaderboardList,
    loading,
    error,
    isConnected,
    isSubmitting,
    myUserId,
    // 延时提醒
    showExtensionAlert,
    extensionSeconds,
    alertTrigger,
    setRoomDisplay,
    initBidsList,
    appendNewBid,
    setLeaderboard,
    setLoading,
    setError,
    setConnected,
    setSubmitting,
    setExtensionAlert,
    resetStore,
    submitBid,
    loadLeaderboard,
  };

  return (
    <AuctionContext.Provider value={store}>
      {children}
    </AuctionContext.Provider>
  );
};
