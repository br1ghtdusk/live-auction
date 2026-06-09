import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, AlertCircle, PartyPopper, Wallet, X, Lightbulb, CheckCircle2, CircleDollarSign, CreditCard } from 'lucide-react';
import { useAuctionStore } from '../hooks/useAuctionstore';
import { formatPrice } from '../../../shared/utils/formatPrice';
import './Payment.css';

const Payment = () => {
  const {
    currentAuction: auction,
    myUserId,
    paymentStatus,
    payAuction,
  } = useAuctionStore();

  const [showPayModal, setShowPayModal] = useState(false);
  const [payMethod, setPayMethod] = useState<'wechat' | 'alipay'>('wechat');

  const isWinner = auction?.status === 'SOLD' && auction?.highest_bidder_id === myUserId;
  const isSold = auction?.status === 'SOLD';

  const handlePay = async () => {
    if (auction?.id && myUserId) {
      const success = await payAuction(auction.id, myUserId);
      if (success) {
        setTimeout(() => setShowPayModal(false), 1500);
      }
    }
  };

  return (
    <>
      {/* 支付相关 UI - 仅在 SOLD 状态下展示 */}
      {isSold && (
        <div className="payment-section">
          {isWinner ? (
            <>
              {paymentStatus === 'pending' && (
                <button
                  onClick={() => setShowPayModal(true)}
                  className="payment-btn primary"
                >
                  立即支付 {formatPrice(auction.current_price)}
                </button>
              )}
              {paymentStatus === 'paying' && (
                <div className="payment-status paying">
                  <div className="spinner-sm" />
                  <span>支付处理中...</span>
                </div>
              )}
              {paymentStatus === 'paid' && (
                <div className="payment-status paid">
                  <PartyPopper className="w-8 h-8 text-success animate-bounce" />
                  <span className="status-title">支付成功！</span>
                  <span className="status-desc">商品正在打包中</span>
                </div>
              )}
              {paymentStatus === 'timeout' && (
                <div className="payment-status timeout">
                  <Clock className="w-8 h-8 text-gray-400 animate-pulse" />
                  <span className="status-title">支付超时</span>
                  <span className="status-desc">商品已流拍</span>
                </div>
              )}
            </>
          ) : (
            <div className="payment-section observer">
              <span className="observer-hint">
                {paymentStatus === 'paid' ? <><CheckCircle2 className="inline w-4 h-4 text-success mr-1" />该商品已完成支付</> :
                  paymentStatus === 'timeout' ? <><AlertCircle className="inline w-4 h-4 text-red-400 mr-1" />该商品已流拍</> :
                  <><CircleDollarSign className="inline w-4 h-4 text-yellow-400 mr-1" />等待获胜者完成支付...</>}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 支付弹窗 */}
      <AnimatePresence>
        {showPayModal && (
          <motion.div
            className="pay-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (paymentStatus !== 'paying') {
                setShowPayModal(false);
              }
            }}
          >
            <motion.div
              className="pay-modal"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="pay-modal-header">
                <div className="pay-modal-title">收银台</div>
                <button
                  className="pay-modal-close"
                  onClick={() => {
                    if (paymentStatus !== 'paying') {
                      setShowPayModal(false);
                    }
                  }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="pay-modal-body">
                <div className="pay-product-info">
                  <span className="pay-product-name">{auction?.name}</span>
                  <span className="pay-product-price">{formatPrice(auction?.current_price || 0)}</span>
                </div>

                <div className="pay-method-section">
                  <span className="pay-method-label">选择支付方式</span>
                  <div className="pay-method-options">
                    <button
                      className={`pay-method-option ${payMethod === 'wechat' ? 'active' : ''}`}
                      onClick={() => setPayMethod('wechat')}
                    >
                      <CreditCard className="w-6 h-6 text-green-500" />
                      <span className="pay-method-name">微信支付</span>
                      {payMethod === 'wechat' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                    </button>
                    <button
                      className={`pay-method-option ${payMethod === 'alipay' ? 'active' : ''}`}
                      onClick={() => setPayMethod('alipay')}
                    >
                      <Wallet className="w-6 h-6 text-blue-500" />
                      <span className="pay-method-name">支付宝</span>
                      {payMethod === 'alipay' && <CheckCircle2 className="w-5 h-5 text-blue-500" />}
                    </button>
                  </div>
                </div>

                <button
                  className="pay-confirm-btn"
                  disabled={paymentStatus === 'paying'}
                  onClick={handlePay}
                >
                  {paymentStatus === 'paying' ? (
                    <>
                      <div className="spinner-md" />
                      <span>处理中...</span>
                    </>
                  ) : (
                    <span>确认支付 {formatPrice(auction?.current_price || 0)}</span>
                  )}
                </button>

                <div className="pay-modal-footer">
                  <span className="pay-tip"><Lightbulb className="inline w-4 h-4 text-amber-400 mr-1" />支付成功后商品将由商家安排发货</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Payment;