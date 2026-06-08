import { useState, useEffect } from 'react';
import {
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Card,
  Typography,
  Space,
  Radio,
  DatePicker,
  Switch,
  Divider,
  message,
} from 'antd';
import { ShoppingOutlined, SendOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import request from '../../../utils/request';

const { Text } = Typography;

interface AuctionFormValues {
  name: string;
  imageUrl?: string;
  description?: string;
  startPrice: number;
  bidIncrement: number;
  duration: number;
  ceilingPrice?: number;
  startType: 'immediate' | 'scheduled';
  scheduledTime?: dayjs.Dayjs;
  enableAntiSniper: boolean;
  extendTriggerSeconds: number;
  autoExtendSeconds: number;
  maxExtendCount: number;
  roomId: number;
}

interface RoomOption {
  value: number;
  label: string;
}

const DURATION_OPTIONS = [
  { value: 180, label: '3 分钟' },
  { value: 300, label: '5 分钟' },
  { value: 900, label: '15 分钟' },
  { value: 1800, label: '30 分钟' },
  { value: 3600, label: '1 小时' },
];

const AuctionForm = () => {
  const [form] = Form.useForm<AuctionFormValues>();
  const [loading, setLoading] = useState(false);
  const [roomOptions, setRoomOptions] = useState<RoomOption[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);

  const startType = Form.useWatch('startType', form);
  const enableAntiSniper = Form.useWatch('enableAntiSniper', form);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        setRoomsLoading(true);
        const merchantId = localStorage.getItem('merchantId');
        const url = merchantId
          ? `/rooms?merchantId=${merchantId}`
          : '/rooms';
        const res = await request.get(url);

        if (res.data?.data && Array.isArray(res.data.data)) {
          const options = res.data.data.map((room: { id: number; room_name: string }) => ({
            value: room.id,
            label: room.room_name,
          }));
          setRoomOptions(options);

          if (options.length > 0) {
            form.setFieldsValue({ roomId: options[0].value });
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
  }, [form]);

  const handleFinish = async (values: AuctionFormValues) => {
    setLoading(true);

    try {
      const scheduledStartTime =
        values.startType === 'immediate'
          ? Date.now()
          : values.scheduledTime!.valueOf();

      const scheduledEndTime = scheduledStartTime + values.duration * 1000;

      const merchantId = localStorage.getItem('merchantId') || '1001';

      const payload = {
        name: values.name,
        imageUrl: values.imageUrl || '',
        startPrice: values.startPrice,
        bidIncrement: values.bidIncrement,
        duration: values.duration,
        ceilingPrice: values.ceilingPrice,
        scheduledStartTime,
        scheduledEndTime,
        description: values.description || '',
        extendTriggerSeconds: values.extendTriggerSeconds,
        autoExtendSeconds: values.autoExtendSeconds,
        maxExtendCount: values.maxExtendCount,
        roomId: values.roomId,  
        merchantId, 
      };

      console.log('[AuctionForm] 提交数据:', payload);

      await request.post('/admin/auctions', payload);

      message.success('商品已成功准备上架');
      form.resetFields();
    } catch (error) {
      message.error('上架失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      style={{ maxWidth: 800 }}
      className="shadow-sm"
      title={
        <Space>
          <ShoppingOutlined />
          <span>发布新拍品</span>
        </Space>
      }
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        autoComplete="off"
        size="large"
        initialValues={{
          startType: 'immediate',
          enableAntiSniper: true,
          extendTriggerSeconds: 10,
          autoExtendSeconds: 10,
          maxExtendCount: 99,
          roomId: 101,  // 默认 roomId
        }}
      >
        <Divider plain>
          <Text strong>基础信息</Text>
        </Divider>

        <Form.Item
          label={<Text strong>上架直播间</Text>}
          name="roomId"
          rules={[
            { required: true, message: '请选择要上架的直播间' },
          ]}
        >
          <Select
            placeholder="请选择直播间"
            style={{ width: '100%' }}
            options={roomOptions}
            loading={roomsLoading}
            notFoundContent={roomsLoading ? '加载中...' : '暂无可用直播间'}
          />
        </Form.Item>

        <Form.Item
          label={<Text strong>商品名称</Text>}
          name="name"
          rules={[
            { required: true, message: '请输入商品名称' },
            { min: 2, max: 50, message: '商品名称长度为 2-50 个字符' },
          ]}
        >
          <Input placeholder="例如：iPhone 15 Pro Max 256G 银色" />
        </Form.Item>

        <Form.Item
          label={
            <Space>
              <Text strong>商品封面图片 URL</Text>
              <Text type="secondary" className="text-xs font-normal">
                （选填）
              </Text>
            </Space>
          }
          name="imageUrl"
        >
          <Input placeholder="https://example.com/product.jpg" />
        </Form.Item>

        <Form.Item
          label={
            <Space>
              <Text strong>商品描述</Text>
              <Text type="secondary" className="text-xs font-normal">
                （选填）
              </Text>
            </Space>
          }
          name="description"
        >
          <Input.TextArea
            placeholder="请输入商品描述信息..."
            rows={3}
            showCount
            maxLength={500}
          />
        </Form.Item>

        <Divider plain>
          <Text strong>价格规则</Text>
        </Divider>

        <div className="grid grid-cols-2 gap-4">
          <Form.Item
            label={<Text strong>起拍价格</Text>}
            name="startPrice"
            rules={[
              { required: true, message: '请输入起拍价' },
              { type: 'number', min: 0, message: '起拍价不能为负数' },
            ]}
          >
            <InputNumber
              prefix="￥"
              placeholder="0"
              style={{ width: '100%' }}
              min={0}
              precision={2}
            />
          </Form.Item>

          <Form.Item
            label={<Text strong>加价幅度</Text>}
            name="bidIncrement"
            rules={[
              { required: true, message: '请输入加价幅度' },
              { type: 'number', min: 1, message: '加价幅度至少为 1 元' },
            ]}
          >
            <InputNumber
              prefix="￥"
              placeholder="50"
              style={{ width: '100%' }}
              min={1}
              precision={2}
            />
          </Form.Item>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Form.Item
            label={<Text strong>拍卖持续时长</Text>}
            name="duration"
            rules={[{ required: true, message: '请选择拍卖时长' }]}
          >
            <Select placeholder="请选择拍卖时长" options={DURATION_OPTIONS} />
          </Form.Item>

          <Form.Item
            label={
              <Space>
                <Text strong>封顶价</Text>
                <Text type="secondary" className="text-xs font-normal">
                  （选填）
                </Text>
              </Space>
            }
            name="ceilingPrice"
            rules={[
              {
                validator: (_, value) => {
                  if (value === undefined || value === null || value === '') {
                    return Promise.resolve();
                  }
                  const startPrice = form.getFieldValue('startPrice');
                  if (startPrice !== undefined && value <= startPrice) {
                    return Promise.reject(new Error('封顶价必须大于起拍价'));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <InputNumber
              prefix="￥"
              placeholder="留空则无封顶"
              style={{ width: '100%' }}
              min={0}
              precision={2}
            />
          </Form.Item>
        </div>

        <Divider plain>
          <Text strong>竞拍日程与规则</Text>
        </Divider>

        <Form.Item
          label={<Text strong>开拍时间</Text>}
          name="startType"
        >
          <Radio.Group>
            <Radio.Button value="immediate">即刻开拍</Radio.Button>
            <Radio.Button value="scheduled">定时开拍</Radio.Button>
          </Radio.Group>
        </Form.Item>

        {startType === 'scheduled' && (
          <Form.Item
            label={<Text strong>选择开拍时间</Text>}
            name="scheduledTime"
            rules={[{ required: true, message: '请选择开拍时间' }]}
          >
            <DatePicker
              showTime
              format="YYYY-MM-DD HH:mm:ss"
              style={{ width: '100%' }}
              disabledDate={(current) =>
                current && current < dayjs().startOf('minute')
              }
            />
          </Form.Item>
        )}

        <Form.Item
          label={<Text strong>开启防秒杀自动延时</Text>}
          name="enableAntiSniper"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        {enableAntiSniper && (
          <div className="grid grid-cols-3 gap-4 pl-4 border-l-2 border-gray-200">
            <Form.Item
              label={<Text strong>触发阈值（秒）</Text>}
              name="extendTriggerSeconds"
              rules={[
                { required: true, message: '请输入触发阈值' },
                { type: 'number', min: 1, message: '至少 1 秒' },
              ]}
            >
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              label={<Text strong>延时增加（秒）</Text>}
              name="autoExtendSeconds"
              rules={[
                { required: true, message: '请输入延时时长' },
                { type: 'number', min: 1, message: '至少 1 秒' },
              ]}
            >
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              label={<Text strong>最大延时次数</Text>}
              name="maxExtendCount"
              rules={[
                { required: true, message: '请输入最大次数' },
                { type: 'number', min: 0, message: '不能为负数' },
              ]}
            >
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </div>
        )}

        <Text type="secondary" className="block mb-4 text-xs">
          💡 提示：防秒杀机制可在竞拍最后 N 秒有出价时，自动延时 X 秒，最多次数 Y 次，防止最后一秒恶意秒杀
        </Text>

        <Form.Item className="mb-0">
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            icon={<SendOutlined />}
            size="large"
            block
          >
            {loading ? '准备上架中...' : '上架拍品'}
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default AuctionForm;
