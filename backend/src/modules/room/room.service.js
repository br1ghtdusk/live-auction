const db = require('../../infrastructure/db');
const logger = require('../../utils/logger');
const time = require('../../utils/time');

class RoomService {
  async findActiveRooms(merchantId = null) {
    let sql = 'SELECT id, merchant_id, room_name FROM rooms WHERE status = ?';
    const params = ['ACTIVE'];

    if (merchantId) {
      sql += ' AND merchant_id = ?';
      params.push(merchantId);
    }

    sql += ' ORDER BY id ASC';

    const [rows] = await db.getPool().execute(sql, params);
    return rows;
  }

  async findById(roomId) {
    const [rows] = await db.getPool().execute(
      'SELECT id, merchant_id, room_name, status, created_at FROM rooms WHERE id = ?',
      [roomId]
    );
    return rows[0] || null;
  }

  async getRoomDisplayState(roomId) {
    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    const now = Date.now();
    
    const mysqlRepo = require('../auction/auction.mysql.repository');
    const redisRepo = require('../auction/auction.redis.repository');
    
    const auctions = await mysqlRepo.findByRoomId(roomId, 10, 0);
    
    if (auctions.length === 0) {
        logger.info(`[Room Service] 房间 ${roomId} 没有任何拍品记录`);
        return { mode: 'IDLE', auction: null, bidderCount: 0 };
    }
    
    const targetAuction = auctions.find(a => a.status === 'BIDDING') || auctions[0];
    
    const auctionService = require('../auction/auction.service');
    const leaderboardData = await auctionService.getLeaderboard(targetAuction.id);
    const bidderCount = leaderboardData.bidderCount;

    const biddingAuction = auctions.find(a => a.status === 'BIDDING');
    if (biddingAuction) {
        let detail = await mysqlRepo.findById(biddingAuction.id);
        
        try {
            const redisAuction = await redisRepo.findById(biddingAuction.id);
            if (redisAuction && redisAuction.current_price !== undefined) {
                detail = {
                    ...detail,
                    current_price: Number(redisAuction.current_price),
                    highest_bidder_id: redisAuction.highest_bidder_id ? Number(redisAuction.highest_bidder_id) : detail.highest_bidder_id,
                    scheduled_end_time: redisAuction.scheduled_end_time || detail.scheduled_end_time,
                    extend_count: redisAuction.extend_count ? Number(redisAuction.extend_count) : detail.extend_count,
                    status: redisAuction.status || detail.status,
                };
            }
        } catch (e) {
            logger.warn(`[Room Service] Redis读取失败，使用MySQL数据: ${e.message}`);
        }
        
        logger.info(`[Room Service] 房间 ${roomId} 找到进行中的拍品 ID: ${biddingAuction.id}`);
        return { mode: 'ACTIVE', auction: detail, bidderCount };
    }
    
    const waitingAuctions = auctions.filter(a => a.status === 'WAITING');
    if (waitingAuctions.length > 0) {
        waitingAuctions.sort((a, b) => 
            new Date(a.scheduled_start_time).getTime() - new Date(b.scheduled_start_time).getTime()
        );
        const nearestWaiting = waitingAuctions[0];
        const detail = await mysqlRepo.findById(nearestWaiting.id);
        logger.info(`[Room Service] 房间 ${roomId} 找到即将开始的拍品 ID: ${nearestWaiting.id}`);
        return { mode: 'ACTIVE', auction: detail, bidderCount };
    }
    
    const endedAuctions = auctions.filter(a => 
        ['SOLD', 'FAILED', 'CANCELLED'].includes(a.status)
    );
    
    if (endedAuctions.length > 0) {
        endedAuctions.sort((a, b) => b.id - a.id);
        const latestEnded = endedAuctions[0];
        
        const auctionEndTime = latestEnded.actual_end_time 
            ? new Date(latestEnded.actual_end_time).getTime()
            : new Date(latestEnded.scheduled_end_time).getTime();
        
        const timeSinceEnd = now - auctionEndTime;
        
        if (timeSinceEnd <= FIVE_MINUTES_MS) {
            const detail = await mysqlRepo.findById(latestEnded.id);
            logger.info(`[Room Service] 房间 ${roomId} 找到刚结束的拍品 ID: ${latestEnded.id}，结束于 ${Math.floor(timeSinceEnd / 1000)} 秒前`);
            return { mode: 'RESULT', auction: detail, bidderCount };
        }
        
        logger.info(`[Room Service] 房间 ${roomId} 最新拍品已结束超过 5 分钟`);
    }
    
    logger.info(`[Room Service] 房间 ${roomId} 处于 IDLE 状态`);
    return { mode: 'IDLE', auction: null, bidderCount: 0 };
  }

  async getActiveAuctionByRoomId(roomId) {
    const displayState = await this.getRoomDisplayState(roomId);
    return displayState.mode !== 'IDLE' ? displayState.auction : null;
  }
}

module.exports = new RoomService();