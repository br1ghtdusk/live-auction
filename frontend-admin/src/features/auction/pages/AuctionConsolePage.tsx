import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card,
  Statistic,
  Tag,
  Button,
  Select,
  Modal,
  Timeline,
  Empty,
  message,
  Typography,
} from 'antd';
import {
  WarningOutlined,
  ClockCircleOutlined,
  TagOutlined,
  DesktopOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import request from '../../../utils/request';
import { ConsoleProvider, useConsoleStore, type BidRecord } from '../store/console.store';

const { Text } = Typography;

const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
  BIDDING: { label: '竞拍中', color: 'red', icon: '🔥' },
  WAITING: { label: '即将开始', color: 'gold', icon: '⏳' },
  SOLD: { label: '已成交', color: 'green', icon: '✅' },
  FAILED: { label: '已流拍', color: 'default', icon: '😢' },
  CANCELLED: { label: '已取消', color: 'default', icon: '🚫' },
};

// ============ 大屏主视图组件 ============
const LiveView = () => {
  const {
    roomDisplayMode,
    currentAuction,
    bidsList,
  } = useConsoleStore();

  const [countdownText, setCountdownText] = useState<string>('00:00:00');
  const [countdownLabel, setCountdownLabel] = useState<string>('剩余时间');
  const countdownRef = useRef<number | null>(null);

  // 清理倒计时
  const clearCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  // 倒计时逻辑（局部心跳，不走 Context）
  useEffect(() => {
    // 非 ACTIVE 模式，停止倒计时
    if (roomDisplayMode !== 'ACTIVE' || !currentAuction) {
      setCountdownText('00:00:00');
      setCountdownLabel('剩余时间');
      clearCountdown();
      return;
    }

    const { status, scheduled_start_time, scheduled_end_time } = currentAuction;
    let targetTime: number;

    if (status === 'WAITING') {
      setCountdownLabel('距离开始还有');
      targetTime = scheduled_start_time;
    } else if (status === 'BIDDING') {
      setCountdownLabel('剩余时间');
      targetTime = scheduled_end_time;
    } else {
      setCountdownText('00:00:00');
      setCountdownLabel('剩余时间');
      clearCountdown();
      return;
    }

    if (targetTime <= 0) {
      setCountdownText('00:00:00');
      clearCountdown();
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const remaining = Math.max(0, targetTime - now);
      const seconds = Math.floor(remaining / 1000);
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      setCountdownText(`${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
    };

    updateCountdown();
    countdownRef.current = window.setInterval(updateCountdown, 1000);

    return () => clearCountdown();
  }, [roomDisplayMode, currentAuction, clearCountdown]);

  const currentStatus = statusConfig[currentAuction?.status || 'WAITING'] || statusConfig.WAITING;
  const isEndedStatus = ['SOLD', 'FAILED', 'CANCELLED'].includes(currentAuction?.status || '');

  const renderContent = () => {
    switch (roomDisplayMode) {
      case 'IDLE':
        return (
          <Empty
            description={
              <div className="text-center">
                <div className="text-lg font-bold text-gray-600 mb-2">🎉 当前直播间暂无进行中的竞拍</div>
                <div className="text-gray-400">请等待主播发布下一件拍品</div>
              </div>
            }
            style={{ padding: '60px 0' }}
          />
        );

      case 'RESULT':
        return (
          <>
            {currentAuction && (
              <div className="mb-4 pb-3 border-b border-gray-200">
                <Text strong type="secondary" className="text-sm">竞拍结果</Text>
                <div className="text-lg font-bold text-gray-800">{currentAuction.name}</div>
              </div>
            )}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <Statistic
                  title="成交价"
                  value={currentAuction?.current_price ? currentAuction.current_price / 100 : 0}
                  prefix="¥"
                  suffix=".00"
                  styles={{ content: { fontSize: 48, fontWeight: 'bold', color: '#52c41a' } }}
                />
                <div className="flex flex-col justify-center">
                  <Tag color={currentStatus.color} style={{ fontSize: 16, padding: '8px 16px' }}>
                    <span>{currentStatus.icon}</span>
                    <span className="ml-2">{currentStatus.label}</span>
                  </Tag>
                </div>
              </div>
              <Statistic
                title="剩余时间"
                value="00:00:00"
                prefix={<ClockCircleOutlined className="text-gray-400" />}
                styles={{ content: { fontSize: 36, fontWeight: 'bold', color: '#999' } }}
              />
            </div>

            {currentAuction?.status === 'SOLD' && currentAuction?.highest_bidder_id && (
              <Card className="mb-4" bordered={false} style={{ backgroundColor: '#f6ffed', border: '1px solid #b7eb8f' }}>
                <div className="flex items-center gap-4">
                  <TrophyOutlined className="text-yellow-500" style={{ fontSize: 40 }} />
                  <div>
                    <div className="text-sm text-gray-500">恭喜成交</div>
                    <div className="text-lg font-bold text-green-600">
                      用户 {currentAuction.highest_bidder_id} 以 ¥{currentAuction.current_price / 100}.00 成功拍得
                    </div>
                  </div>
                </div>
              </Card>
            )}

            <Button
              type="primary"
              danger
              size="large"
              icon={<WarningOutlined />}
              disabled
              style={{ width: '100%', height: 60, fontSize: 18, fontWeight: 'bold' }}
            >
              🚨 紧急取消竞拍
            </Button>
          </>
        );

      case 'ACTIVE':
      default:
        return (
          <>
            {currentAuction && (
              <div className="mb-4 pb-3 border-b border-gray-200">
                <Text strong type="secondary" className="text-sm">当前竞拍</Text>
                <div className="text-lg font-bold text-gray-800">{currentAuction.name}</div>
              </div>
            )}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <Statistic
                  title="当前最高价"
                  value={currentAuction?.current_price ? currentAuction.current_price / 100 : 0}
                  prefix="¥"
                  suffix=".00"
                  styles={{ content: { fontSize: 48, fontWeight: 'bold', color: '#ff4d4f' } }}
                />
                <div className="flex flex-col justify-center">
                  <Tag color={currentStatus.color} style={{ fontSize: 16, padding: '8px 16px' }}>
                    <span>{currentStatus.icon}</span>
                    <span className="ml-2">{currentStatus.label}</span>
                  </Tag>
                </div>
              </div>
              <Statistic
                title={countdownLabel}
                value={countdownText}
                prefix={<ClockCircleOutlined className="text-blue-500" />}
                styles={{ content: { fontSize: 36, fontWeight: 'bold', color: '#1890ff' } }}
              />
            </div>

            <Button
              type="primary"
              danger
              size="large"
              icon={<WarningOutlined />}
              disabled={isEndedStatus || !currentAuction}
              style={{ width: '100%', height: 60, fontSize: 18, fontWeight: 'bold' }}
            >
              🚨 紧急取消竞拍
            </Button>
          </>
        );
    }
  };

  return (
    <>
      <Card className="shadow-lg">
        {renderContent()}
      </Card>

      <Card title="实时出价流水" className="shadow-md">
        <div className="h-[300px] overflow-y-auto">
          {bidsList.length > 0 ? (
            <Timeline
              mode="start"
              items={bidsList.map((record) => ({
                key: record.id,
                icon: <TagOutlined className="text-orange-500" />,
                content: (
                  <div className="py-2 flex justify-between items-center">
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{`用户 ${record.userId}`}</div>
                      <div style={{ color: '#666', fontSize: '12px' }}>{`出价时间: ${record.time}`}</div>
                    </div>
                    <div style={{ color: '#ff4d4f', fontWeight: 'bold' }}>{`¥${record.amount}.00`}</div>
                  </div>
                ),
              }))}
            />
          ) : (
            <Empty description="暂无出价记录" />
          )}
        </div>
      </Card>
    </>
  );
};

// ============ 主页面组件 ============
const AuctionConsoleContent = () => {
  const merchantId = localStorage.getItem('merchantId');

  const {
    currentAuction,
    setRoomDisplay,
    initBidsList,
    appendNewBid,
    resetStore,
  } = useConsoleStore();

  const [roomOptions, setRoomOptions] = useState<{ value: number; label: string }[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [roomsLoading, setRoomsLoading] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);

  // 获取直播间列表
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        setRoomsLoading(true);
        const url = merchantId ? `/rooms?merchantId=${merchantId}` : '/rooms';
        const res = await request.get(url);

        if (res.data?.data && Array.isArray(res.data.data)) {
          const options = res.data.data.map((room: { id: number; room_name: string }) => ({
            value: room.id,
            label: room.room_name,
          }));
          setRoomOptions(options);

          if (options.length > 0 && selectedRoom === null) {
            setSelectedRoom(options[0].value);
          }
        }
      } catch (error) {
        console.error('获取直播间列表失败:', error);
        message.error('获取直播间列表失败');
      } finally {
        setRoomsLoading(false);
      }
    };

    fetchRooms();
  }, [merchantId]);

  // 拉取历史出价记录
  const fetchBidHistory = useCallback(async (auctionId: string | number) => {
    try {
      const res = await request.get(`/admin/auctions/${auctionId}/bids`);
      if (res.data?.success && Array.isArray(res.data.data)) {
        initBidsList(res.data.data);
      }
    } catch (error) {
      console.error('[AuctionConsole] 拉取出价历史失败:', error);
    }
  }, [initBidsList]);

  // WebSocket 消息处理
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'room_display': {
          const { mode, auction } = data.data;
          setRoomDisplay(mode as 'ACTIVE' | 'RESULT' | 'IDLE', auction || null);
          if (auction) {
            fetchBidHistory(auction.id);
          }
          break;
        }

        case 'price_update': {
          const priceData = data.data;
          const newBid: BidRecord = {
            id: Date.now(),
            userId: priceData.highestBidderId,
            amount: priceData.currentPrice / 100,
            time: new Date().toLocaleTimeString(),
          };
          appendNewBid(newBid);
          break;
        }

        case 'auction_ended': {
          const endData = data.data;
          message.info(endData.status === 'cancelled' ? '竞拍已取消' : '竞拍已结束');
          break;
        }
      }
    } catch (error) {
      console.error('消息解析错误:', error);
    }
  }, [setRoomDisplay, fetchBidHistory, appendNewBid]);

  // 自动连接 WebSocket
  useEffect(() => {
    if (selectedRoom === null || roomsLoading) return;

    resetStore();
    const ws = new WebSocket(`ws://localhost:8081?roomId=${selectedRoom}`);

    ws.onopen = () => {
      setIsConnected(true);
      message.success('成功连接到直播间');
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error('WebSocket 错误:', error);
      message.error('连接失败，请检查后端服务');
    };

    ws.onmessage = handleMessage;
    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [selectedRoom, roomsLoading, handleMessage, resetStore]);

  // 取消竞拍
  const confirmCancel = async () => {
    if (!currentAuction) return;
    try {
      await request.post(`/admin/auctions/${currentAuction.id}/cancel`);
      setShowCancelModal(false);
      message.success('取消指令已发送，等待 WebSocket 同步状态...');
    } catch (error) {
      console.error('取消竞拍失败:', error);
      message.error('取消失败，请稍后重试');
    }
  };

  // 查看直播间画面
  const handleViewLive = () => {
    if (selectedRoom) {
      window.open(`http://localhost:5173/?roomId=${selectedRoom}`, '_blank', 'width=375,height=812');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select
            value={selectedRoom}
            onChange={(value) => setSelectedRoom(value)}
            options={roomOptions}
            style={{ width: 200 }}
            placeholder="选择直播间"
            disabled={roomsLoading}
            loading={roomsLoading}
            notFoundContent={roomsLoading ? '加载中...' : '暂无可用直播间'}
          />
          {isConnected && (
            <Tag color="green">
              <span>● </span>
              <span>已连接</span>
            </Tag>
          )}
        </div>
        <Button
          type="primary"
          icon={<DesktopOutlined />}
          onClick={handleViewLive}
          size="large"
          disabled={!selectedRoom}
        >
          查看直播间画面
        </Button>
      </div>

      <LiveView />

      <Modal
        title="确认取消竞拍"
        open={showCancelModal}
        onOk={confirmCancel}
        onCancel={() => setShowCancelModal(false)}
        okText="确认取消"
        cancelText="返回"
        okType="danger"
      >
        <p>您确定要紧急取消当前竞拍吗？</p>
        <p className="text-red-500 mt-2">⚠️ 此操作将立即结束竞拍，无法恢复！</p>
      </Modal>
    </div>
  );
};

// ============ 页面入口（包裹 Provider）============
const AuctionConsolePage = () => {
  return (
    <ConsoleProvider>
      <AuctionConsoleContent />
    </ConsoleProvider>
  );
};

export default AuctionConsolePage;
