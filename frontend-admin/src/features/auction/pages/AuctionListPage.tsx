import { useState, useEffect } from 'react';
import { Table, Tag, Button, Empty, Spin, message, Modal } from 'antd';
import { ReloadOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import request from '../../../utils/request';

interface AuctionItem {
  id: number;
  name: string;
  imageUrl: string | null;
  startPrice: number;
  currentPrice: number | null;
  status: 'WAITING' | 'BIDDING' | 'SOLD' | 'FAILED' | 'CANCELED' | string;
  scheduledStartTime: string;
  scheduledEndTime: string;
}

interface GetAuctionsResponse {
  success: boolean;
  data: AuctionItem[];
  total: number;
  error?: string;
}

const AuctionListPage = () => {
  const [auctions, setAuctions] = useState<AuctionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const getCurrentMerchantId = (): string => {
    const stored = localStorage.getItem('merchantId');
    return stored || '1001';
  };

  const fetchAuctions = async () => {
    setLoading(true);
    try {
      const merchantId = getCurrentMerchantId();
      const response = await request.get<GetAuctionsResponse>(
        `/admin/auctions?merchantId=${merchantId}`
      );
      if (response.data.success) {
        setAuctions(response.data.data);
      } else {
        message.error(response.data.error || '获取拍品列表失败');
      }
    } catch (err) {
      message.error('获取拍品列表失败，请稍后重试');
      console.error('[AuctionList] 获取拍品失败:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAuctions();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAuctions();
  };

  const handleCancel = async (id: number) => {
    Modal.confirm({
      title: '确认取消拍品',
      content: '您确定要取消这个拍品吗？此操作不可恢复。',
      okText: '确认取消',
      cancelText: '取消',
      okType: 'danger',
      onOk: () => {
        console.log(`[AuctionList] 取消拍品: ${id}`);
        message.info(`拍品 ${id} 已取消（演示模式）`);
      },
    });
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  const statusConfig: Record<string, { label: string; color: 'default' | 'success' | 'red' | 'volcano' | 'warning' }> = {
    WAITING: { label: '未开始', color: 'default' },
    BIDDING: { label: '竞拍中', color: 'success' },
    SOLD: { label: '已售出', color: 'volcano' },
    FAILED: { label: '流拍', color: 'warning' },
    CANCELED: { label: '已取消', color: 'default' },
  };

  const columns = [
    {
      title: '商品ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (id: number) => <span className="font-medium">#{id}</span>,
    },
    {
      title: '商品信息',
      dataIndex: 'name',
      key: 'name',
      render: (_: string, record: AuctionItem) => (
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
            {record.imageUrl ? (
              <img
                src={record.imageUrl}
                alt={record.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <ShoppingCartOutlined className="w-6 h-6" />
              </div>
            )}
          </div>
          <span className="font-medium text-gray-900 truncate max-w-[250px]">
            {record.name}
          </span>
        </div>
      ),
    },
    {
      title: '起拍价格',
      dataIndex: 'startPrice',
      key: 'startPrice',
      width: 120,
      render: (price: number) => (
        <span className="font-bold text-red-600">¥{(price / 100).toFixed(2)}</span>
      ),
    },
    {
      title: '当前价/成交价',
      dataIndex: 'currentPrice',
      key: 'currentPrice',
      width: 140,
      render: (price: number | null) => {
        if (!price || price <= 0) {
          return <span className="text-gray-400">-</span>;
        }
        return (
          <span className="font-bold text-orange-500">¥{(price / 100).toFixed(2)}</span>
        );
      },
    },
    {
      title: '当前状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: AuctionItem['status']) => {
        const config = statusConfig[status] || { label: status || '未知状态', color: 'default' as const };
        return (
          <Tag
            color={config.color}
            className={status === 'BIDDING' ? 'animate-pulse' : ''}
          >
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: '时间信息',
      dataIndex: 'scheduledStartTime',
      key: 'time',
      width: 220,
      render: (_: string, record: AuctionItem) => (
        <div className="text-sm">
          <div className="text-gray-600">
            <span className="text-gray-400">开拍:</span>
            {formatDate(record.scheduledStartTime)}
          </div>
          <div className="text-gray-600 mt-1">
            <span className="text-gray-400">结束:</span>
            {formatDate(record.scheduledEndTime)}
          </div>
        </div>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: string, record: AuctionItem) => {
        if (record.status === 'WAITING') {
          return (
            <Button
              type="link"
              danger
              onClick={() => handleCancel(record.id)}
            >
              取消拍品
            </Button>
          );
        }
        return <span className="text-gray-400 text-sm">-</span>;
      },
    },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">拍品管理</h1>
          <p className="text-sm text-gray-500 mt-1">管理您发布的所有拍品</p>
        </div>
        <Button
          onClick={handleRefresh}
          loading={refreshing}
          icon={<ReloadOutlined />}
        >
          刷新数据
        </Button>
      </div>

      <Spin spinning={loading}>
        <Table
          dataSource={auctions}
          columns={columns}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
          locale={{
            emptyText: (
              <Empty description="暂无拍品" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ),
          }}
          className="bg-white rounded-xl shadow-sm"
        />
      </Spin>
    </div>
  );
};

export default AuctionListPage;