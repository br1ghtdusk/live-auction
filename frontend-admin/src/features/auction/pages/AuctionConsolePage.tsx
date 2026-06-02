import React, { useState, useEffect } from 'react';
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
} from 'antd';
import {
  PlayCircleOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  TagOutlined,
} from '@ant-design/icons';

interface BidRecord {
  id: number;
  userId: number;
  amount: number;
  time: string;
}

const AuctionConsolePage: React.FC = () => {
  const [selectedRoom, setSelectedRoom] = useState<string>('room-001');
  const [selectedAuction, setSelectedAuction] = useState<string>('auction-001');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [status, setStatus] = useState<'BIDDING' | 'WAITING' | 'ENDED'>('BIDDING');
  const [currentPrice, setCurrentPrice] = useState<number>(8999);
  const [countdown, setCountdown] = useState<number>(3600);
  const [bidHistory, setBidHistory] = useState<BidRecord[]>([
    { id: 1, userId: 4599, amount: 8999, time: '10:30:25' },
    { id: 2, userId: 3210, amount: 8500, time: '10:28:12' },
    { id: 3, userId: 4599, amount: 8000, time: '10:25:45' },
    { id: 4, userId: 1890, amount: 7500, time: '10:22:30' },
    { id: 5, userId: 4599, amount: 7000, time: '10:20:00' },
  ]);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);

  const roomOptions = [
    { value: 'room-001', label: '直播间 A' },
    { value: 'room-002', label: '直播间 B' },
    { value: 'room-003', label: '直播间 C' },
  ];

  const auctionOptions = [
    { value: 'auction-001', label: 'iPhone 15 Pro Max' },
    { value: 'auction-002', label: 'MacBook Pro 16' },
    { value: 'auction-003', label: 'AirPods Pro 2' },
  ];

  useEffect(() => {
    if (!isConnected || status !== 'BIDDING') return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 0) {
          setStatus('ENDED');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isConnected, status]);

  useEffect(() => {
    if (!isConnected) return;

    const bidTimer = setInterval(() => {
      const newBid: BidRecord = {
        id: Date.now(),
        userId: Math.floor(Math.random() * 9000) + 1000,
        amount: currentPrice + Math.floor(Math.random() * 500),
        time: new Date().toLocaleTimeString(),
      };
      setCurrentPrice(newBid.amount);
      setBidHistory((prev) => [newBid, ...prev].slice(0, 10));
    }, 15000);

    return () => clearInterval(bidTimer);
  }, [isConnected, currentPrice]);

  const handleConnect = () => {
    if (isConnected) {
      setIsConnected(false);
      message.info('已断开与直播间的连接');
    } else {
      setIsConnected(true);
      message.success('成功连接到直播间');
    }
  };

  const handleCancelAuction = () => {
    setShowCancelModal(true);
  };

  const confirmCancel = () => {
    setStatus('ENDED');
    setIsConnected(false);
    setShowCancelModal(false);
    message.warning('竞拍已紧急取消');
  };

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const statusConfig = {
    BIDDING: { label: '竞拍中', color: 'red' as const, icon: '🔥' },
    WAITING: { label: '即将开始', color: 'gold' as const, icon: '⏳' },
    ENDED: { label: '已结束', color: 'default' as const, icon: '✅' },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select
            value={selectedRoom}
            onChange={setSelectedRoom}
            options={roomOptions}
            style={{ width: 180 }}
            placeholder="选择直播间"
          />
          <Select
            value={selectedAuction}
            onChange={setSelectedAuction}
            options={auctionOptions}
            style={{ width: 220 }}
            placeholder="选择拍品"
          />
        </div>
        <Button
          type={isConnected ? 'default' : 'primary'}
          icon={isConnected ? <ClockCircleOutlined /> : <PlayCircleOutlined />}
          onClick={handleConnect}
          size="large"
        >
          {isConnected ? '断开连接' : '连接直播间'}
        </Button>
      </div>

      <Card className="shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Statistic
              title="当前最高价"
              value={currentPrice}
              prefix="¥"
              suffix=".00"
              styles={{ content: { fontSize: 48, fontWeight: 'bold', color: '#ff4d4f' } }}
            />
            <div className="flex flex-col justify-center">
              <Tag
                color={statusConfig[status].color}
                style={{ fontSize: 16, padding: '8px 16px' }}
              >
                <span>{statusConfig[status].icon}</span>
                <span className="ml-2">{statusConfig[status].label}</span>
              </Tag>
            </div>
          </div>
          <Statistic
            title="剩余时间"
            value={formatTime(countdown)}
            prefix={<ClockCircleOutlined className="text-blue-500" />}
            styles={{ content: { fontSize: 36, fontWeight: 'bold', color: '#1890ff' } }}
          />
        </div>

        <Button
          type="primary"
          danger
          size="large"
          icon={<WarningOutlined />}
          onClick={handleCancelAuction}
          disabled={status === 'ENDED'}
          style={{
            width: '100%',
            height: 60,
            fontSize: 18,
            fontWeight: 'bold',
          }}
        >
          🚨 紧急取消竞拍
        </Button>
      </Card>

      <Card title="实时出价流水" className="shadow-md">
        <div className="h-[300px] overflow-y-auto">
          {bidHistory.length > 0 ? (
            <Timeline
              mode="start"
              items={bidHistory.map((record) => ({
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

      <Modal
        title="确认取消竞拍"
        visible={showCancelModal}
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

export default AuctionConsolePage;