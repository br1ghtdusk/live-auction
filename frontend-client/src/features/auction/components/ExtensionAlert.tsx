import { useEffect } from 'react';
import { useAuctionStore } from '../hooks/useAuctionstore';
import './ExtensionAlert.css';

export const ExtensionAlert = () => {
  const { showExtensionAlert, extensionSeconds, alertTrigger, setExtensionAlert } = useAuctionStore();

  useEffect(() => {
    if (showExtensionAlert) {
      // 每次 alertTrigger 改变（代表收到了新的延时消息），都会清除老定时器，重新计算 3 秒
      const timer = setTimeout(() => {
        setExtensionAlert(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [showExtensionAlert, alertTrigger, setExtensionAlert]);

  if (!showExtensionAlert) return null;

  return (
    <div className="extension-alert">
      <span className="alert-icon">⏰</span>
      <span className="alert-text">
        有人绝地出价！竞拍延长 <strong>{extensionSeconds}</strong> 秒
      </span>
    </div>
  );
};
