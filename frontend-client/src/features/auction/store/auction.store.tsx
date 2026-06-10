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
  maxBidAmount: number;  // 最高出价（分）
  bidCount: number;      // 出价次数
}

export type PaymentStatus = 'pending' | 'paying' | 'paid' | 'timeout';

export interface ConsoleState {
  roomDisplayMode: RoomDisplayMode;
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
// 不读取 .env 配置，避免 localhost 覆盖动态获取
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
  const auctionIdRef = useRef<number | undefined>(undefined); // 用于跟踪 auctionId 变化

  useEffect(() => {
    paymentStatusRef.current = paymentStatus;
  }, [paymentStatus]);

  // 🌟 核心逻辑：当 auctionId 变化时自动重置支付状态和出价记录
  useEffect(() => {
    const prevAuctionId = auctionIdRef.current;
    const currentAuctionId = currentAuction?.id;
    
    if (prevAuctionId !== currentAuctionId) {
      console.log('[Auction] auctionId 变化:', { prevAuctionId, currentAuctionId });
      
      // 如果之前有 auctionId（不是首次加载），清空出价数据
      if (prevAuctionId !== undefined) {
        setBidsList([]);
        setLeaderboardList([]);
        setBidderCount(0);
      }
      
      // 如果当前有 auctionId，重置支付状态为 pending
      if (currentAuctionId !== undefined) {
        setPaymentStatusState('pending');
        console.log('[Payment] 已重置支付状态为 pending');
      }
      
      // 更新 auctionIdRef
      auctionIdRef.current = currentAuctionId;
    }
  }, [currentAuction?.id]);

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

  const setBidderCountAction = useCallback((count: number) => {
    setBidderCount(count);
  }, []);

  // 重置 store
  const resetStore = useCallback(() => {
    setRoomDisplayMode(initialState.roomDisplayMode);
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

  // ============ 支付相关 Actions ============
  const setPaymentStatus = useCallback((status: PaymentStatus) => {
    setPaymentStatusState(status);
  }, []);

  const resetPaymentStatus = useCallback(() => {
    setPaymentStatusState('pending');
    console.log('[Payment] 已重置支付状态为 pending');
  }, []);

  // 清空出价记录和排行榜（用于新商品上架时）
  const resetAuctionData = useCallback(() => {
    setBidsList([]);
    setLeaderboardList([]);
    setBidderCount(0);
    console.log('[Auction] 已清空出价记录和排行榜');
  }, []);

  const payOrder = useCallback(async (auctionId: number, userId: number): Promise<boolean> => {
    if (paymentStatusRef.current === 'paying') {
      console.warn('[Payment] 支付进行中，忽略重复请求');
      return false;
    }
    if (paymentStatusRef.current === 'paid') {
      toast.success('该商品已完成支付', {
        icon: <PartyPopper className="w-5 h-5 text-green-500" />
      });
      return true;
    }

    setPaymentStatusState('paying');

    try {
      const result = await auctionApi.payOrder(auctionId, userId);

      if (result.success) {
        // 支付成功状态会由 WebSocket 推送更新
        toast.success('正在确认支付...');
        return true;
      } else {
        setPaymentStatusState('pending');
        toast.error(result.message || '支付失败，请重试');
        return false;
      }
    } catch (err: any) {
      console.error('[Payment] 支付接口调用失败:', err);
      setPaymentStatusState('pending');
      toast.error('支付请求失败，请检查网络后重试');
      return false;
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
  const lastSyncTimeRef = useRef<number>(0);  // 记录最后一次同步时间
  const reconnectDelayRef = useRef<number>(1000);  // 重连延迟，指数退避

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
        // 后端返回结构为 { list: [], bidderCount: number }
        if (res.data && res.data.list) {
          setLeaderboard(res.data.list);
          setBidderCount(res.data.bidderCount);
        }
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
      // ... 保持原有逻辑不变 ...
      try {
        const data = JSON.parse(event.data);
        console.log('[WS] Received message:', data.type, data.data);

        // 调试：检查 price_update 事件是否进入
        if (data.type === 'price_update') {
          console.log('[WS Debug] 进入 price_update 处理分支');
          console.log('[WS Debug] priceData:', data.data);
          console.log('[WS Debug] currentPrice:', data.data?.currentPrice);
        }

        switch (data.type) {
          case 'room_display': {
            const { mode, auction, bidderCount } = data.data;
            const cleanedAuction = auction ? sanitizeAuctionData(auction) : null;

            // auctionId 变化检测已由 useEffect 处理，自动清空出价记录和重置支付状态

            setRoomDisplayMode(mode);
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
            console.log('[AuctionStore] 收到 price_update 事件:', JSON.stringify(priceData, null, 2));
            console.log('[AuctionStore] currentPrice:', priceData.currentPrice);
            console.log('[AuctionStore] highestBidderId:', priceData.highestBidderId);
            
            if (priceData.bidderCount !== undefined) setBidderCount(priceData.bidderCount);
            if (priceData.leaderboardList) setLeaderboard(priceData.leaderboardList);

            // 被超越提醒逻辑
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
            // 直接调用 setBidsList，避免依赖 appendNewBid
            setBidsList((prev) => [newBid, ...prev].slice(0, 50));
            
            // 同步更新当前拍品状态，确保价格与后端一致
            console.log('[AuctionStore] 更新 currentAuction 前: current_price=', currentAuctionRef.current?.current_price);
            setCurrentAuction((prev) => {
              if (!prev) {
                console.log('[AuctionStore] currentAuction 为 null，跳过更新');
                return null;
              }
              const updated = {
                ...prev,
                current_price: priceData.currentPrice,
                highest_bidder_id: priceData.highestBidderId,
                scheduled_end_time: priceData.endTime ?? prev.scheduled_end_time,
                extend_count: priceData.extendCount ?? prev.extend_count,
              };
              console.log('[AuctionStore] 更新 currentAuction 后: current_price=', updated.current_price);
              // 立即同步 Ref，避免 React State 异步更新导致的竞态问题
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
            console.log('[WS] 收到支付成功通知:', data.data);
            setPaymentStatusState('paid');

            // 只有获胜者才显示支付成功 Toast
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
            console.log('[WS] 收到支付超时通知:', data.data);
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

    // 重置重连延迟
    reconnectDelayRef.current = 1000;

    // 创建 WebSocket 连接
    const createConnection = () => {
      // 初始化
      if (wsRef.current?.readyState !== WebSocket.CLOSED) {
        wsRef.current?.close();
      }

      setLoading(true);

      // WebSocket 连接（主要数据来源）
      console.log("WS_URL =", WS_URL);
      const sanitizedWsUrl = `${WS_URL}/?roomId=${roomId}`.replace(/\/+\?/, '/?');
      console.log("sanitizedWsUrl =", sanitizedWsUrl);
      const ws = new WebSocket(sanitizedWsUrl);
      
      ws.onopen = () => {
        console.log('[WS] OPEN');
        setConnected(true);
        setError(null);
        // 🌟 重连成功后立即触发全量状态同步
        reconnectDelayRef.current = 1000; // 重置延迟
        fetchCurrentAuction();
      };
      
      ws.onclose = (e) => {
        console.log('[WS] CLOSE', {
          code: e.code,
          reason: e.reason,
          wasClean: e.wasClean,
        });
        setConnected(false);
        
        // 🌟 自动重连（指数退避）
        const delay = reconnectDelayRef.current;
        console.log(`[WS] 准备 ${delay}ms 后重连`);
        setTimeout(() => {
          createConnection();
        }, delay);
        
        // 指数退避：每次失败后延迟翻倍，最大 16 秒
        reconnectDelayRef.current = Math.min(delay * 2, 16000);
      };
      
      ws.onerror = (event) => {
        console.error('[WS] ERROR', event);
      };
      
      ws.onmessage = handleMessage;
      wsRef.current = ws;
    };

    // 立即创建连接
    createConnection();

    // 清理函数：页面退出时关闭连接，防止内存泄漏
    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null; // 防止触发重连
        wsRef.current.close();
        wsRef.current = null;
      }
      if (bidTimeoutRef.current) {
        clearTimeout(bidTimeoutRef.current);
      }
    };
  }, [roomId]); // 依赖数组只有 roomId，确保 WebSocket 不会因业务状态变化而重连

  // 🌟 页面唤醒强制同步：监听 visibilitychange
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        const timeSinceLastSync = now - lastSyncTimeRef.current;
        
        // 如果距上次同步超过 10 秒，强制刷新状态
        if (timeSinceLastSync > 10000) {
          console.log(`[Sync] 页面唤醒，距上次同步 ${timeSinceLastSync}ms，触发强制同步`);
          await fetchCurrentAuction();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // 拉取当前拍卖全量状态
  const fetchCurrentAuction = useCallback(async () => {
    try {
      const res = await auctionApi.getRoomDisplayState(roomId);
      if (res.code === 0 || res.code === 200) {
        const { mode, auction, bidderCount } = res.data;
        const cleanedAuction = auction ? sanitizeAuctionData(auction) : null;

        // auctionId 变化检测已由 useEffect 处理，自动清空出价记录和重置支付状态

        setRoomDisplayMode(mode);
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
  }, [roomId, loadAuctionData]);

  const store: ConsoleStore = {
    roomDisplayMode,
    currentAuction,
    bidsList,
    leaderboardList,
    bidderCount,
    loading,
    error,
    isConnected,
    isSubmitting,
    myUserId,
    showExtensionAlert,
    extensionSeconds,
    alertTrigger,
    paymentStatus,
    setRoomDisplay,
    initBidsList,
    appendNewBid,
    setLeaderboard,
    setBidderCount: setBidderCountAction,
    setLoading,
    setError,
    setConnected,
    setSubmitting,
    setExtensionAlert,
    resetStore,
    submitBid,
    loadLeaderboard,
    setPaymentStatus,
    resetPaymentStatus,
    resetAuctionData,
    payOrder,
  };

  return (
    <AuctionContext.Provider value={store}>
      {children}
    </AuctionContext.Provider>
  );
};
