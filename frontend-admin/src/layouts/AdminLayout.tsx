import React, { useState } from 'react';
import { Layout, Menu, Typography, Avatar, Dropdown, type MenuProps } from 'antd';
import {
  DashboardOutlined,
  ShoppingOutlined,
  OrderedListOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const menuItems: MenuProps['items'] = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: '数据大盘',
  },
  {
    key: '/auction',
    icon: <ShoppingOutlined />,
    label: '拍卖控制台',
  },
  {
    key: '/order',
    icon: <OrderedListOutlined />,
    label: '订单管理',
  },
];

const AdminLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    navigate('/login');
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
    },
  ];

  const selectedKey = menuItems.find((item) =>
    location.pathname.startsWith(item?.key as string)
  )?.key as string || '/dashboard';

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

          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div className="flex items-center gap-3 cursor-pointer">
              <Avatar
                size="small"
                icon={<UserOutlined />}
                style={{ background: '#1677ff' }}
              />
              <Text type="secondary">商家用户</Text>
            </div>
          </Dropdown>
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
