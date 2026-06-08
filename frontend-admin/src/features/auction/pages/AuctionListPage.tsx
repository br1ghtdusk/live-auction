import { useState, useEffect } from 'react';
import { Table, Tag, Button, Empty, Spin, message, Modal, Form, InputNumber, DatePicker, Space, Input } from 'antd';
import { ReloadOutlined, ShoppingCartOutlined, EditOutlined } from '@ant-design/icons';
import request from '../../../utils/request';
import dayjs from 'dayjs';

interface AuctionItem {
  id: number;
  name: string;
  imageUrl: string | null;
  startPrice: number;
  currentPrice: number | null;
  bidIncrement: number;
  ceilingPrice: number;
  status: 'WAITING' | 'BIDDING' | 'SOLD' | 'FAILED' | 'CANCELLED' | string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  description?: string;
  extendTriggerSeconds?: number;
  autoExtendSeconds?: number;
  maxExtendCount?: number;
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
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingAuction, setEditingAuction] = useState<AuctionItem | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [form] = Form.useForm();

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
      title: '确认下架拍品',
      content: '确定要下架并取消这场竞拍吗？此操作不可恢复。',
      okText: '确认下架',
      cancelText: '取消',
      okType: 'danger',
      async onOk() {
        try {
          await request.post(`/admin/auctions/${id}/cancel`);
          message.success('商品下架成功');
          fetchAuctions();
        } catch (err) {
          message.error('下架失败，请稍后重试');
          console.error('[AuctionList] 下架拍品失败:', err);
          throw err;
        }
      },
    });
  };

  // 打开修改规则弹窗
  const handleEdit = (auction: AuctionItem) => {
    setEditingAuction(auction);
    form.setFieldsValue({
      name: auction.name,
      startPrice: auction.startPrice / 100, // 分转元
      currentPrice: (auction.currentPrice || auction.startPrice) / 100,
      bidIncrement: auction.bidIncrement / 100,
      ceilingPrice: auction.ceilingPrice / 100,
      scheduledStartTime: dayjs(auction.scheduledStartTime),
      scheduledEndTime: dayjs(auction.scheduledEndTime),
      duration: Math.round((new Date(auction.scheduledEndTime).getTime() - new Date(auction.scheduledStartTime).getTime()) / 1000),
      description: auction.description,
      extendTriggerSeconds: auction.extendTriggerSeconds || 10,
      autoExtendSeconds: auction.autoExtendSeconds || 10,
      maxExtendCount: auction.maxExtendCount || 99,
    });
    setEditModalVisible(true);
  };

  // 提交修改
  const handleEditSubmit = async () => {
    try {
      const values = await form.validateFields();
      setEditLoading(true);

      const payload = {
        name: values.name,
        startPrice: Math.round(values.startPrice * 100), // 元转分
        currentPrice: Math.round(values.currentPrice * 100),
        bidIncrement: Math.round(values.bidIncrement * 100),
        ceilingPrice: Math.round(values.ceilingPrice * 100),
        scheduledStartTime: values.scheduledStartTime.valueOf(),
        scheduledEndTime: values.scheduledEndTime.valueOf(),
        description: values.description,
        extendTriggerSeconds: values.extendTriggerSeconds,
        autoExtendSeconds: values.autoExtendSeconds,
        maxExtendCount: values.maxExtendCount,
      };

      await request.put(`/admin/auctions/${editingAuction?.id}`, payload);
      message.success('拍品规则修改成功');
      setEditModalVisible(false);
      setEditingAuction(null);
      form.resetFields();
      fetchAuctions();
    } catch (err: any) {
      if (err.errorFields) {
        // 表单校验错误，不做处理
        return;
      }
      message.error(err.response?.data?.message || '修改失败，请稍后重试');
      console.error('[AuctionList] 修改拍品规则失败:', err);
    } finally {
      setEditLoading(false);
    }
  };

  // 关闭弹窗
  const handleEditModalClose = () => {
    setEditModalVisible(false);
    setEditingAuction(null);
    form.resetFields();
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
    CANCELLED: { label: '已取消', color: 'default' },
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
      width: 180,
      render: (_: string, record: AuctionItem) => {
        const canEdit = record.status === 'WAITING';
        const canCancel = record.status === 'WAITING' || record.status === 'BIDDING';

        return (
          <Space size="small">
            {canEdit && (
              <Button
                type="link"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
              >
                修改规则
              </Button>
            )}
            {canCancel && (
              <Button
                type="link"
                danger
                onClick={() => handleCancel(record.id)}
              >
                下架
              </Button>
            )}
            {!canEdit && !canCancel && (
              <span className="text-gray-400 text-sm">-</span>
            )}
          </Space>
        );
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

      {/* 修改规则弹窗 */}
      <Modal
        title={`修改拍品规则 - ${editingAuction?.name || ''}`}
        open={editModalVisible}
        onOk={handleEditSubmit}
        onCancel={handleEditModalClose}
        confirmLoading={editLoading}
        okText="保存修改"
        cancelText="取消"
        width={600}
        destroyOnHidden={true}
      >
        <Form
          form={form}
          layout="vertical"
          className="mt-4"
        >
          <Form.Item
            name="name"
            label="商品名称"
            rules={[{ required: true, message: '请输入商品名称' }]}
          >
            <Input placeholder="请输入商品名称" />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="startPrice"
              label="起拍价（元）"
              rules={[{ required: true, message: '请输入起拍价' }]}
            >
              <InputNumber min={0.01} step={0.01} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              name="currentPrice"
              label="当前价（元）"
              rules={[{ required: true, message: '请输入当前价' }]}
            >
              <InputNumber min={0.01} step={0.01} style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="bidIncrement"
              label="加价幅度（元）"
              rules={[{ required: true, message: '请输入加价幅度' }]}
            >
              <InputNumber min={1} step={1} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              name="ceilingPrice"
              label="封顶价（元）"
              rules={[{ required: true, message: '请输入封顶价' }]}
            >
              <InputNumber min={0} step={1} style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="scheduledStartTime"
              label="计划开始时间"
              rules={[{ required: true, message: '请选择开始时间' }]}
            >
              <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              name="scheduledEndTime"
              label="计划结束时间"
              rules={[{ required: true, message: '请选择结束时间' }]}
            >
              <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Form.Item
              name="extendTriggerSeconds"
              label="延时触发（秒）"
              rules={[{ required: true, message: '请输入延时触发秒数' }]}
            >
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              name="autoExtendSeconds"
              label="每次延时（秒）"
              rules={[{ required: true, message: '请输入延时秒数' }]}
            >
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              name="maxExtendCount"
              label="最大延时次数"
              rules={[{ required: true, message: '请输入最大延时次数' }]}
            >
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <Form.Item
            name="description"
            label="商品描述"
          >
            <Input.TextArea rows={3} placeholder="请输入商品描述（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AuctionListPage;