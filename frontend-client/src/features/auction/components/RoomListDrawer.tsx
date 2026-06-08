import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auctionApi, type RoomItem } from '../services/auction.api';
import './RoomListDrawer.css';

interface RoomListDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoomId: number;
  onSwitchRoom: (roomId: number) => void;
}

export const RoomListDrawer: React.FC<RoomListDrawerProps> = ({
  isOpen,
  onClose,
  currentRoomId,
  onSwitchRoom,
}) => {
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadRooms();
    }
  }, [isOpen]);

  const loadRooms = async () => {
    setLoading(true);
    try {
      const res = await auctionApi.getRooms();
      if (res.code === 0) {
        setRooms(res.data);
      }
    } catch (err) {
      console.error('加载直播间列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="room-list-overlay"
          />
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="room-list-drawer"
          >
            <div className="drawer-header">
              <h3 className="drawer-title">直播间列表</h3>
              <button className="drawer-close" onClick={onClose}>×</button>
            </div>

            <div className="drawer-content">
              {loading ? (
                <div className="drawer-loading">
                  <div className="loading-spinner-small" />
                  <span>加载中...</span>
                </div>
              ) : rooms.length > 0 ? (
                <div className="room-grid">
                  {rooms.map((room) => (
                    <button
                      key={room.id}
                      className={`room-item ${room.id === currentRoomId ? 'active' : ''}`}
                      onClick={() => {
                        onSwitchRoom(room.id);
                        onClose();
                      }}
                    >
                      <div className="room-indicator" />
                      <div className="room-info">
                        <span className="room-name">{room.room_name}</span>
                        <span className="room-id">ID: {room.id}</span>
                      </div>
                      {room.id === currentRoomId && <span className="current-badge">正在观看</span>}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="drawer-empty">暂无活跃直播间</div>
              )}
            </div>
            
            <div className="drawer-footer">
              <span className="footer-hint">选择一个房间进行跳转</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
