import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * WebSocket 基础消息接口
 * 所有业务消息类型必须继承此接口
 */
export interface BaseWsMessage {
  type: string;
  data?: any;
}

/**
 * useWebSocket Hook 配置选项（泛型版本）
 * @template T - 业务消息类型，必须继承 BaseWsMessage
 */
export interface UseWebSocketOptions<T extends BaseWsMessage> {
  /** WebSocket 服务器地址 */
  url: string;
  /** 断线重连延迟时间（毫秒），默认 3000 */
  reconnectDelay?: number;
  /** 收到消息时的回调 */
  onMessage?: (message: T) => void;
  /** 连接成功时的回调 */
  onConnect?: () => void;
  /** 连接断开时的回调 */
  onDisconnect?: () => void;
}

/**
 * useWebSocket Hook 返回类型（泛型版本）
 * @template T - 业务消息类型
 */
export interface UseWebSocketReturn<T extends BaseWsMessage> {
  /** WebSocket 连接状态 */
  isConnected: boolean;
  /** 发送消息，返回是否发送成功 */
  sendMessage: (message: object) => boolean;
  /** 主动关闭连接 */
  close: () => void;
  /** 当前消息类型（仅用于类型推导） */
  messageType?: T;
}

/**
 * WebSocket 自定义 Hook（泛型版本）
 * 提供 WebSocket 连接管理、自动重连、消息处理等功能
 * @template T - 业务消息类型，必须继承 BaseWsMessage
 */
export const useWebSocket = <T extends BaseWsMessage>(
  options: UseWebSocketOptions<T>
): UseWebSocketReturn<T> => {
  const {
    url,
    reconnectDelay = 3000,
    onMessage,
    onConnect,
    onDisconnect,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  /** 使用 ref 存储回调函数，避免 useCallback 依赖变化导致重新连接 */
  const onMessageRef = useRef<(message: T) => void>(onMessage);
  const onConnectRef = useRef<(() => void) | undefined>(onConnect);
  const onDisconnectRef = useRef<(() => void) | undefined>(onDisconnect);

  useEffect(() => {
    onMessageRef.current = onMessage;
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
  });

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    if (wsRef.current) {
      wsRef.current.close();
    }

    console.log('[useWebSocket] 正在连接...', url);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[useWebSocket] 连接成功');
      setIsConnected(true);
      onConnectRef.current?.();
    };

    ws.onmessage = (event) => {
      try {
        const message: T = JSON.parse(event.data);
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
      console.log('[useWebSocket] 连接断开');
      setIsConnected(false);
      onDisconnectRef.current?.();

      reconnectTimerRef.current = window.setTimeout(() => {
        console.log('[useWebSocket] 尝试重新连接...');
        connect();
      }, reconnectDelay);
    };
  }, [url, reconnectDelay]);

  const sendMessage = useCallback((message: object): boolean => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('[useWebSocket] WebSocket 未连接，无法发送消息');
      return false;
    }
    wsRef.current.send(JSON.stringify(message));
    return true;
  }, []);

  const close = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

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
