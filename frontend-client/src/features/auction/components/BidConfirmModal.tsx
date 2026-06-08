import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatPrice } from '../../../shared/utils/formatPrice';
import './BidConfirmModal.css';

interface BidConfirmModalProps {
  isOpen: boolean;
  amount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const BidConfirmModal: React.FC<BidConfirmModalProps> = ({
  isOpen,
  amount,
  onConfirm,
  onCancel,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景变暗遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="bid-confirm-overlay"
          />
          
          {/* 弹窗主体 */}
          <div className="bid-confirm-container">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bid-confirm-dialog"
            >
              <div className="dialog-header">
                <span className="warning-icon">⚠️</span>
                <h3 className="dialog-title">确认您的出价</h3>
              </div>
              
              <div className="dialog-content">
                <div className="amount-display">
                  <span className="amount-label">出价金额</span>
                  <span className="amount-value">{formatPrice(amount)}</span>
                </div>
                <p className="warning-text">
                  请确认您的出价。一旦提交，<strong>出价无法修改或撤回</strong>。
                </p>
              </div>
              
              <div className="dialog-actions">
                <button 
                  className="btn-confirm" 
                  onClick={onConfirm}
                >
                  确认出价
                </button>
                <button 
                  className="btn-cancel" 
                  onClick={onCancel}
                >
                  再想想
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
