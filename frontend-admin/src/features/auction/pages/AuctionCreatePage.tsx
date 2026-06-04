import { Typography } from 'antd';
import AuctionForm from '../components/AuctionForm';

const { Title, Text } = Typography;

const AuctionCreatePage = () => {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Title level={3} style={{ margin: 0 }}>发布新拍品</Title>
        <Text type="secondary">填写拍品信息并设定竞拍规则，开始一场新的拍卖。</Text>
      </div>

      <div className="flex justify-center mt-6">
        <AuctionForm />
      </div>
    </div>
  );
};

export default AuctionCreatePage;