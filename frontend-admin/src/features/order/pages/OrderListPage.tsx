import { useState, useEffect } from 'react';
import { Button, Table, Tag, Empty, Spin, message } from 'antd';
import { ReloadOutlined, ShoppingCartOutlined, UserOutlined, ClockCircleOutlined } from '@ant-design/icons';
import type { Order } from '../types/order.types';
import { getMerchantOrders } from '../services/order.api';

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function StatusTag({ status }: { status: Order['status'] }) {
  const statusConfig = {
    PENDING: {
      label: '待支付',
      color: 'gold',
      icon: '⚠️'
    },
    PAID: {
      label: '已支付',
      color: 'success',
      icon: '✅'
    },
    CANCELLED: {
      label: '已取消',
      color: 'default',
      icon: '❌'
    },
    REFUNDED: {
      label: '已退款',
      color: 'blue',
      icon: '🔄'
    }
  };

  const config = statusConfig[status];

  return (
    <Tag color={config.color}>
      <span>{config.icon}</span>
      <span className="ml-1">{config.label}</span>
    </Tag>
  );
}

function ProductInfo({ name, image }: { name: string; image: string | null }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
        {image ? (
          <img
            src={image}
            alt={name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <ShoppingCartOutlined className="w-5 h-5" />
          </div>
        )}
      </div>
      <span className="font-medium text-gray-900 truncate max-w-[200px]">{name}</span>
    </div>
  );
}

const OrderListPage = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const getCurrentMerchantId = (): number => {
    const stored = localStorage.getItem('merchantId');
    return stored ? parseInt(stored, 10) : 1001;
  };

  const fetchOrders = async () => {
    setLoading(true);

    try {
      const merchantId = getCurrentMerchantId();
      const response = await getMerchantOrders(merchantId);
      
      if (response.success) {
        setOrders(response.data);
      } else {
        message.error(response.error || '获取订单失败');
      }
    } catch (err) {
      message.error('获取订单失败，请稍后重试');
      console.error('[OrderList] 获取订单失败:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const columns = [
    {
      title: '订单ID',
      dataIndex: 'orderId',
      key: 'orderId',
      width: 100,
      render: (id: number) => <span className="font-medium">#{id}</span>,
    },
    {
      title: '商品信息',
      dataIndex: 'auctionName',
      key: 'auctionName',
      render: (_: string, record: Order) => (
        <ProductInfo name={record.auctionName} image={record.auctionImage} />
      ),
    },
    {
      title: '中拍用户ID',
      dataIndex: 'winnerId',
      key: 'winnerId',
      width: 120,
      render: (id: number) => (
        <span className="flex items-center gap-1 text-gray-700">
          <UserOutlined className="w-4 h-4" />
          {id}
        </span>
      ),
    },
    {
      title: '成交金额',
      dataIndex: 'finalPrice',
      key: 'finalPrice',
      width: 120,
      render: (price: string) => (
        <span className="font-semibold text-red-600">¥{price}</span>
      ),
    },
    {
      title: '订单状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: Order['status']) => <StatusTag status={status} />,
    },
    {
      title: '成交时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => (
        <span className="flex items-center gap-1 text-gray-600">
          <ClockCircleOutlined className="w-4 h-4" />
          {formatDate(date)}
        </span>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">订单管理</h1>
          <p className="text-sm text-gray-500 mt-1">查看和管理您的拍卖订单</p>
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
          dataSource={orders}
          columns={columns}
          rowKey="orderId"
          pagination={{
            pageSize: 10,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
          locale={{
            emptyText: (
              <Empty
                description="暂无订单"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
          className="bg-white rounded-xl shadow-sm"
        />
      </Spin>
    </div>
  );
};

export default OrderListPage;