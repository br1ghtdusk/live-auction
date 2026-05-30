import { useState, useEffect, useRef, useCallback } from 'react';

export interface BaseWsMessage {
  type: string;
  data?: any;
}

export interface UseWebSocketOptions<T extends BaseWsMessage> {
  url: string;
  initialReconnectDelay?: number;
  maxReconnectDelay?: number;
  pingInterval?: number;
  pongTimeout?: number; // 业务可控传入固定值，不传则内部生成带抖动的值
  onMessage?: (message: T) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export interface UseWebSocketReturn<T extends BaseWsMessage> {
  isConnected: boolean;
  sendMessage: (message: object) => boolean;
  close: () => void;
  messageType?: T;
}

export const useWebSocket = <T extends BaseWsMessage>(
  options: UseWebSocketOptions<T>
): UseWebSocketReturn<T> => {
  const {
    url,
    initialReconnectDelay = 1000,
    maxReconnectDelay = 16000,
    pingInterval = 10000,
    pongTimeout,
    onMessage,
    onConnect,
    onDisconnect,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const pingTimerRef = useRef<number | null>(null);
  const pongTimeoutTimerRef = useRef<number | null>(null);
  const currentDelayRef = useRef<number>(initialReconnectDelay);

  // 修复暗雷 1：利用 useRef 动态生成并固化 pongTimeout，防止因为 Math.random() 导致 Hook 依赖频繁失效
  const actualPongTimeoutRef = useRef<number>(0);
  if (actualPongTimeoutRef.current === 0) {
    actualPongTimeoutRef.current = pongTimeout ?? (3000 + Math.random() * 2000);
  }

  const onMessageRef = useRef<(message: T) => void>(onMessage);
  const onConnectRef = useRef<(() => void) | undefined>(onConnect);
  const onDisconnectRef = useRef<(() => void) | undefined>(onDisconnect);

  useEffect(() => {
    onMessageRef.current = onMessage;
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
  });

  const clearPongTimeout = useCallback(() => {
    if (pongTimeoutTimerRef.current) {
      clearTimeout(pongTimeoutTimerRef.current);
      pongTimeoutTimerRef.current = null;
    }
  }, []);

  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
    clearPongTimeout();
  }, [clearPongTimeout]);

  const startHeartbeat = useCallback(() => {
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
    }
    pingTimerRef.current = window.setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
        console.log('[useWebSocket] 发送心跳 ping');

        clearPongTimeout();
        pongTimeoutTimerRef.current = window.setTimeout(() => {
          console.error('[useWebSocket] Pong 超时，检测到僵尸连接，主动断开并触发重连');
          if (wsRef.current) {
            wsRef.current.close();
          }
        }, actualPongTimeoutRef.current); // 👈 使用固化的 Ref 值
      }
    }, pingInterval);
  }, [pingInterval, clearPongTimeout]); // 👈 移除了不稳定的 pongTimeout 依赖

  const resetReconnectDelay = useCallback(() => {
    currentDelayRef.current = initialReconnectDelay;
  }, [initialReconnectDelay]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    if (wsRef.current) {
      wsRef.current.onclose = null; // 安全清理旧连接的事件
      wsRef.current.close();
    }

    console.log('[useWebSocket] 正在连接...', url);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[useWebSocket] 连接成功');
      setIsConnected(true);
      resetReconnectDelay();
      startHeartbeat();
      onConnectRef.current?.();
    };

    ws.onmessage = (event) => {
      try {
        clearPongTimeout();

        const message: T = JSON.parse(event.data);
        if (message.type === 'pong') {
          console.log('[useWebSocket] 收到心跳 pong，已拦截');
          return;
        }
        console.log('[useWebSocket] 收到消息:', message);
        onMessageRef.current?.(message);
      } catch (err) {
        console.error('[useWebSocket] 解析消息失败:', err);
      }
    };

    ws.onerror = () => {
      console.error('[useWebSocket] 连接错误');
    };

    ws.onclose = () => {
      console.log('[useWebSocket] 连接断开，准备触发自动重连');
      setIsConnected(false);
      clearTimers();
      onDisconnectRef.current?.();

      const jitter = Math.random() * 200;
      const delay = currentDelayRef.current + jitter;
      
      reconnectTimerRef.current = window.setTimeout(() => {
        console.log(`[useWebSocket] 尝试重新连接... (延迟: ${Math.round(delay)}ms)`);
        connect();
      }, delay);

      currentDelayRef.current = Math.min(
        currentDelayRef.current * 2,
        maxReconnectDelay
      );
    };
  }, [url, maxReconnectDelay, clearTimers, resetReconnectDelay, startHeartbeat, clearPongTimeout]);

  const sendMessage = useCallback((message: object): boolean => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('[useWebSocket] WebSocket 未连接，无法发送消息');
      return false;
    }
    wsRef.current.send(JSON.stringify(message));
    return true;
  }, []);

  // 修复暗雷 2：主动关闭或销毁时，提前抹除 onclose 回调，防止“回马枪”误触发自动重连
  const close = useCallback(() => {
    clearTimers();
    if (wsRef.current) {
      console.log('[useWebSocket] 主动关闭连接，解除事件绑定');
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null; // 👈 核心核心：切断异步重连的导火索！
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, [clearTimers]);

  useEffect(() => {
    connect();
    return () => {
      close();
    };
  }, [connect, close]);

  return {
    isConnected,
    sendMessage,
    close,
  };
};

export default useWebSocket;