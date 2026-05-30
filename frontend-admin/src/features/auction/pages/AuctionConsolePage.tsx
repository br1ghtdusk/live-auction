import React from 'react';
import { Typography } from 'antd';
import AuctionForm from '../components/AuctionForm';

const { Title, Text } = Typography;

const AuctionConsolePage: React.FC = () => {
  return (
    <div className="flex flex-col gap-6">
      {/* 页面标题区 */}
      <div>
        <Title level={3} style={{ margin: 0 }}>拍卖控制台</Title>
        <Text type="secondary">在这里发布新的拍品，并设定竞拍规则。</Text>
      </div>

      {/* 把刚才写好的表单组件渲染出来 */}
      <div className="flex justify-center mt-6">
        <AuctionForm />
      </div>
    </div>
  );
};

export default AuctionConsolePage;