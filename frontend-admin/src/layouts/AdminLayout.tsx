import React, { useState, useEffect } from 'react';
import { Layout, Menu, Typography, Select, type MenuProps } from 'antd';
import {
  ShoppingOutlined,
  PlusCircleOutlined,
  MonitorOutlined,
  OrderedListOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const MERCHANT_OPTIONS = [
  { value: '1001', label: '🏪 商家A (ID: 1001)' },
  { value: '1002', label: '🏪 商家B (ID: 1002)' },
];

const STORAGE_KEY = 'merchantId';

const menuItems: MenuProps['items'] = [
  {
    key: '/auction/console',
    icon: <MonitorOutlined />,
    label: '竞拍控制台',
  },
  {
    key: '/auction/create',
    icon: <PlusCircleOutlined />,
    label: '发布拍品',
  },
  {
    key: '/auction/list',
    icon: <ShoppingOutlined />,
    label: '拍品管理',
  },
  {
    key: '/order',
    icon: <OrderedListOutlined />,
    label: '订单管理',
  },
];

const AdminLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [merchantId, setMerchantId] = useState<string>('1001');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setMerchantId(stored);
    } else {
      localStorage.setItem(STORAGE_KEY, '1001');
    }
  }, []);

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
  };

  const handleMerchantChange = (value: string) => {
    localStorage.setItem(STORAGE_KEY, value);
    window.location.reload();
  };

  const selectedKey = menuItems.find((item) =>
    location.pathname.startsWith(item?.key as string)
  )?.key as string || '/auction/console';

  return (
    <Layout className="min-h-screen">
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={220}
        className="overflow-auto"
        style={{ background: '#001529' }}
      >
        <div
          className="h-16 flex items-center justify-center"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
        >
          {collapsed ? (
            <Text strong style={{ color: '#fff', fontSize: 18 }}>
              竞
            </Text>
          ) : (
            <Text strong style={{ color: '#fff', fontSize: 16 }}>
              🎯 实时竞拍管理后台
            </Text>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ marginTop: 8 }}
        />
      </Sider>

      <Layout>
        <Header
          className="flex items-center justify-between px-6"
          style={{
            background: '#fff',
            padding: '0 24px',
            boxShadow: '0 1px 4px rgba(0,21,41,0.08)',
          }}
        >
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-base p-2 rounded hover:bg-gray-100 transition-colors"
            type="button"
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </button>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Text type="secondary" className="text-sm">当前商家：</Text>
              <Select
                value={merchantId}
                onChange={handleMerchantChange}
                options={MERCHANT_OPTIONS}
                style={{ width: 180 }}
                size="middle"
              />
            </div>
          </div>
        </Header>

        <Content
          className="overflow-auto"
          style={{ background: '#f5f5f5' }}
        >
          <div className="p-6">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminLayout;