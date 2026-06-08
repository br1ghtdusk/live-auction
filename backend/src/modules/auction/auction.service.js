const eventBus = require('./event-bus.js');
const mysqlRepo = require('./auction.mysql.repository.js');
const redisRepo = require('./auction.redis.repository.js');
const redis = require('../../infrastructure/redis.js');
const orderService = require('../order/order.service.js');
const mapper = require('./auction.mapper.js');
const constants = require('./auction.constants.js');
const auctionEngine = require('../../engines/auction-engine.js');
const settlementEngine = require('../../engines/settlement-engine.js');
const logger = require('../../utils/logger.js');
const time = require('../../utils/time.js');
const db = require('../../infrastructure/db.js');

async function initializeAuctionCache(id) {
    try {
        await redisRepo.removeAuctionKeys(id);
        logger.info(`[Service Cache] 已清除拍品 ${id} 相关的 Redis 缓存`);

        const auction = await mysqlRepo.findById(id);
        if (auction) {
            const domain = mapper.toDomainFromMysql(auction);
            domain.created_at = Date.now();
            domain.updated_at = Date.now();
            await redisRepo.save(id, domain);
            logger.info(`[Service Cache] 成功对商品实例 ${id} 进行缓存预热`);
        }
    } catch (error) {
        logger.error('[Service Cache] 启动预热过程抛出异常:', error);
    }
}

async function warmUpActiveAuctionsCache() {
    const BATCH_SIZE = 10;

    try {
        logger.info('[Service Cache] 开始动态预热所有活跃拍品缓存...');

        const activeAuctions = await mysqlRepo.findActiveAuctions();
        logger.info(`[Service Cache] 从 MySQL 捞取到 ${activeAuctions.length} 个活跃拍品，将以 ${BATCH_SIZE} 个/批并发预热`);

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < activeAuctions.length; i += BATCH_SIZE) {
            const batch = activeAuctions.slice(i, i + BATCH_SIZE);
            
            const promises = batch.map(async (auction) => {
                try {
                    const detail = await mysqlRepo.findById(auction.id);
                    if (detail) {
                        const domain = mapper.toDomainFromMysql(detail);
                        await redisRepo.save(detail.id, domain);
                        logger.info(`[Service Cache] 成功预热拍品 ${detail.id}: ${detail.name}`);
                        return { success: true };
                    }
                    return { success: false };
                } catch (error) {
                    logger.error(`[Service Cache] 预热拍品 ${auction.id} 失败:`, error);
                    return { success: false };
                }
            });

            const results = await Promise.all(promises);
            results.forEach(result => {
                if (result.success) {
                    successCount++;
                } else {
                    failCount++;
                }
            });

            logger.info(`[Service Cache] 已完成批次 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(activeAuctions.length / BATCH_SIZE)}`);
        }

        logger.info(`[Service Cache] 动态预热完成 - 成功: ${successCount}, 失败: ${failCount}`);
    } catch (error) {
        logger.error('[Service Cache] 动态预热过程抛出异常:', error);
        throw error;
    }
}

async function getAuctionDetail(id) {
    let auction = await redisRepo.findById(id);
    if (!auction) {
        logger.info(`[Service] Redis 穿透，回溯降级拉取 MySQL 实体: ${id}`);
        const mysqlData = await mysqlRepo.findById(id);
        if (mysqlData) {
            auction = mapper.toDomainFromMysql(mysqlData);
            await redisRepo.save(id, auction);
        }
    }
    return auction;
}

async function placeBid(roomId, auctionId, data) {
    const now = Date.now();
    const bidAmount = parseInt(data.bidAmount, 10);
    const userId = parseInt(data.userId, 10);

    const lockKey = constants.REDIS_KEYS.getBidLockKey(auctionId);
    const requestId = `${userId}_${now}_${Math.random().toString(36).substr(2, 9)}`;
    const lockAcquired = await redisRepo.acquireLock(`${lockKey}:${userId}`, requestId, 1000);
    if (!lockAcquired) {
        logger.warn(`[Service] 用户 ${userId} 出价过于频繁，已拦截重复请求`);
        eventBus.emit(constants.WS_EVENTS.SERVER_BROADCAST.BID_REJECTED, {
            roomId,
            userId,
            reason: 'bid_too_frequent'
        });
        return { success: false, reason: 'bid_too_frequent' };
    }

    try {
        let luaResult;
        try {
            luaResult = await redisRepo.executeBidLua(auctionId, userId, bidAmount, now);
        } catch (error) {
            logger.error(`[Service] Lua 脚本执行失败: auctionId=${auctionId}, userId=${userId}`, error);
            
            logger.info(`[Service] 尝试从 MySQL 回源: auctionId=${auctionId}`);
            const mysqlAuction = await mysqlRepo.findById(auctionId);
            if (!mysqlAuction) {
                eventBus.emit(constants.WS_EVENTS.SERVER_BROADCAST.BID_REJECTED, {
                    roomId,
                    userId,
                    reason: 'auction_not_found'
                });
                return { success: false, reason: 'auction_not_found' };
            }
            
            const redisData = mapper.toDomainFromMysql(mysqlAuction);
            await redisRepo.save(auctionId, redisData);
            logger.info(`[Service] MySQL 回源成功并已预热 Redis 缓存: auctionId=${auctionId}`);
            
            luaResult = await redisRepo.executeBidLua(auctionId, userId, bidAmount, now);
        }

        if (!luaResult.success) {
            logger.warn(`[Service] 出价被拒绝: auctionId=${auctionId}, userId=${userId}, reason=${luaResult.reason}`);
            eventBus.emit(constants.WS_EVENTS.SERVER_BROADCAST.BID_REJECTED, {
                roomId,
                userId,
                reason: luaResult.reason,
                requiredMinBid: luaResult.requiredMinBid,
                requiredMaxBid: luaResult.requiredMaxBid,
                debug: luaResult.debug
            });
            return { success: false, reason: luaResult.reason };
        }

        const { is_sold, is_first_activation } = luaResult;

        const updatedAuction = await redisRepo.findById(auctionId);
        if (!updatedAuction) {
            logger.error(`[Service] Lua 执行成功后无法获取更新后的拍卖数据: auctionId=${auctionId}`);
            return { success: false, reason: 'internal_error' };
        }

        const currentPrice = updatedAuction.current_price;

        async function syncToMySQL() {
            const updatedAt = time.formatTimeForMySQL(now);
            
            try {
                const mysqlAuction = await mysqlRepo.findById(auctionId);
                if (!mysqlAuction) {
                    logger.error(`[Service] MySQL 同步失败，商品不存在: auctionId=${auctionId}`);
                    return;
                }

                const version = mysqlAuction.version;
                const highestBidderId = updatedAuction.highest_bidder_id;
                const scheduledEndTime = updatedAuction.scheduled_end_time;

                if (is_sold) {
                    const actualEndTime = time.formatTimeForMySQL(now);
                    await mysqlRepo.updateSettledWithLock(
                        auctionId,
                        constants.AUCTION_STATUS.SOLD,
                        currentPrice,
                        highestBidderId,
                        actualEndTime,
                        version,
                        updatedAt
                    );

                    await orderService.createOrderForAuction(auctionId, mysqlAuction.merchant_id, highestBidderId, currentPrice);
                } else if (is_first_activation) {
                    const actualStartTime = time.formatTimeForMySQL(now);
                    const formattedScheduledEndTime = time.formatTimeForMySQL(scheduledEndTime);
                    await mysqlRepo.activateWithLock(
                        auctionId,
                        constants.AUCTION_STATUS.BIDDING,
                        actualStartTime,
                        formattedScheduledEndTime,
                        version,
                        updatedAt
                    );
                } else {
                    await mysqlRepo.updateStatusAndPriceWithLock(
                        auctionId,
                        constants.AUCTION_STATUS.BIDDING,
                        currentPrice,
                        highestBidderId,
                        version,
                        updatedAt
                    );
                }

                await mysqlRepo.insertBidRecord(
                    auctionId,
                    userId,
                    currentPrice,
                    updatedAt
                );

                logger.info(`[Service] MySQL 同步完成: auctionId=${auctionId}, price=${currentPrice}`);
            } catch (syncError) {
                logger.error(`[Service] MySQL 同步异常: auctionId=${auctionId}`, syncError);
            }
        }

        // 等待同步完成
        await syncToMySQL();
        
        // 同步更新 Redis ZSET 排行榜
        try {
            await redisRepo.updateLeaderboard(auctionId, userId, currentPrice);
        } catch (redisError) {
            logger.error(`[Service] Redis ZSET 更新异常: auctionId=${auctionId}`, redisError);
        }

        if (is_sold) {
            const TTL_SECONDS = 86400;
            await redisRepo.expire(auctionId, TTL_SECONDS);
            
            orderService.startPaymentTimer(
                auctionId,
                roomId,
                updatedAuction.highest_bidder_id,
                updatedAuction.current_price
            );
            
            eventBus.emit(constants.WS_EVENTS.SERVER_BROADCAST.AUCTION_ENDED, {
                roomId,
                winnerId: updatedAuction.highest_bidder_id,
                finalPrice: updatedAuction.current_price,
                status: 'sold'
            });
            return { success: true, type: 'auction_ended', winnerId: updatedAuction.highest_bidder_id, finalPrice: updatedAuction.current_price };
        }

        // 获取最新排行榜和出价人数
        const leaderboardData = await getLeaderboard(auctionId);

        eventBus.emit(constants.WS_EVENTS.SERVER_BROADCAST.PRICE_CHANGED, {
            roomId,
            currentPrice: updatedAuction.current_price,
            highestBidderId: updatedAuction.highest_bidder_id,
            endTime: updatedAuction.scheduled_end_time,
            extendCount: updatedAuction.extend_count,
            status: updatedAuction.status,
            scheduled_start_time: updatedAuction.scheduled_start_time,
            start_price: updatedAuction.start_price,
            bid_increment: updatedAuction.bid_increment,
            ceiling_price: updatedAuction.ceiling_price,
            bidderCount: leaderboardData.bidderCount,
            leaderboardList: leaderboardData.list
        });

        return { success: true, type: 'price_update' };
    } finally {
        await redisRepo.releaseLock(`${lockKey}:${userId}`, requestId);
    }
}

async function checkAndSettleAuctions() {
    try {
        const activeAuctions = await mysqlRepo.findActiveAuctions();

        if (!activeAuctions || activeAuctions.length === 0) {
            return;
        }

        const now = Date.now();

        for (const auctionMeta of activeAuctions) {
            const auctionId = auctionMeta.id;
            const roomId = auctionMeta.room_id;

            try {
                let redisData = await redisRepo.findById(auctionId);
                if (!redisData) {
                    const mysqlAuction = await mysqlRepo.findById(auctionId);
                    if (!mysqlAuction) continue;
                    redisData = mapper.toDomainFromMysql(mysqlAuction);
                    await redisRepo.save(auctionId, redisData);
                }

                const isExpired = now >= redisData.scheduled_end_time;
                const isBiddingExpired = redisData.status === constants.AUCTION_STATUS.BIDDING && isExpired;
                const isWaitingExpired = redisData.status === constants.AUCTION_STATUS.WAITING && isExpired;

                const shouldActivate = 
                    redisData.status === constants.AUCTION_STATUS.WAITING &&
                    now >= redisData.scheduled_start_time && 
                    now < redisData.scheduled_end_time;

                if (shouldActivate) {
                    await redisRepo.setFields(auctionId, {
                        status: constants.AUCTION_STATUS.BIDDING,
                        actual_start_time: now.toString()
                    });
                    
                    const actualStartTime = time.formatTimeForMySQL(now);
                    await mysqlRepo.updateById(auctionId, { 
                        status: constants.AUCTION_STATUS.BIDDING, 
                        updated_at: actualStartTime 
                    });
                    
                    eventBus.emit(constants.WS_EVENTS.SERVER_BROADCAST.ROOM_DISPLAY, {
                        roomId: roomId,
                        data: await getRoomDisplayState(roomId)
                    });
                    continue;
                }

                if ((isBiddingExpired || isWaitingExpired) && !redisData.actual_end_time) {
                    const newState = settlementEngine.settleAuction(redisData, now);

                    await redisRepo.setFields(auctionId, {
                        status: newState.status,
                        final_price: newState.final_price !== null ? newState.final_price : '',
                        actual_end_time: newState.actual_end_time
                    });

                    const actualEndTime = time.formatTimeForMySQL(now);
                    const mysqlAuction = await mysqlRepo.findById(auctionId);

                    await mysqlRepo.settle(
                        auctionId,
                        newState.status,
                        newState.final_price || 0,
                        newState.highest_bidder_id || 0,
                        actualEndTime,
                        actualEndTime
                    );

                    if (newState.status === 'SOLD' && newState.highest_bidder_id) {
                        await orderService.createOrderForAuction(
                            auctionId,
                            mysqlAuction.merchant_id,
                            newState.highest_bidder_id,
                            newState.final_price
                        );

                        orderService.startPaymentTimer(
                            auctionId,
                            roomId,
                            newState.highest_bidder_id,
                            newState.final_price
                        );
                    }

                    await redisRepo.save(auctionId, newState);
                    await redisRepo.expire(auctionId, 86400);

                    eventBus.emit(constants.WS_EVENTS.SERVER_BROADCAST.AUCTION_ENDED, {
                        roomId: roomId,
                        winnerId: newState.highest_bidder_id,
                        finalPrice: newState.final_price,
                        status: newState.status.toLowerCase()
                    });
                }
            } catch (error) {
                logger.error(`[Heartbeat Error] 清算拍卖 ${auctionId} 时发生异常:`, error);
            }
        }
    } catch (error) {
        logger.error('[Heartbeat Error] 清算守护任务阻断:', error);
    }
}

async function createAuction(payload) {
    const {
        name, imageUrl, startPrice, bidIncrement, ceilingPrice,
        scheduledStartTime, scheduledEndTime, description,
        extendTriggerSeconds, autoExtendSeconds, maxExtendCount,
        roomId, merchantId,
    } = payload;

    const auctionData = {
        merchant_id: parseInt(merchantId, 10) || 1001,
        room_id: roomId ?? 101,  
        name,
        description: description || '',
        image_url: imageUrl || '',
        start_price: startPrice * 100,
        current_price: startPrice * 100,
        bid_increment: bidIncrement * 100,
        ceiling_price: ceilingPrice ? ceilingPrice * 100 : 9999999999,
        extend_trigger_seconds: extendTriggerSeconds ?? 10,
        auto_extend_seconds: autoExtendSeconds ?? 10,
        max_extend_count: maxExtendCount ?? 99,
        scheduled_start_time: time.formatTimeForMySQL(scheduledStartTime),
        scheduled_end_time: time.formatTimeForMySQL(scheduledEndTime),
        created_at: time.formatTimeForMySQL(Date.now()),
    };

    const auctionId = await mysqlRepo.create(auctionData);
    return { id: auctionId };
}

async function getRoomDisplayState(roomId) {
    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    const now = Date.now();
    
    const [roomRows] = await db.getPool().execute(
        'SELECT room_name FROM rooms WHERE id = ?',
        [roomId]
    );
    const roomName = roomRows[0]?.room_name || `房间 ${roomId}`;

    const auctions = await mysqlRepo.findByRoomId(roomId, 10, 0);
    
    if (auctions.length === 0) {
        return { mode: 'IDLE', auction: null, bidderCount: 0, roomName };
    }
    
    const targetAuction = auctions.find(a => a.status === 'BIDDING') || auctions[0];
    const leaderboardData = await getLeaderboard(targetAuction.id);
    const bidderCount = leaderboardData.bidderCount;

    const biddingAuction = auctions.find(a => a.status === 'BIDDING');
    if (biddingAuction) {
        const detail = await mysqlRepo.findById(biddingAuction.id);
        return { mode: 'ACTIVE', auction: detail, bidderCount, roomName };
    }
    
    const waitingAuctions = auctions.filter(a => a.status === 'WAITING');
    if (waitingAuctions.length > 0) {
        waitingAuctions.sort((a, b) => 
            new Date(a.scheduled_start_time).getTime() - new Date(b.scheduled_start_time).getTime()
        );
        const detail = await mysqlRepo.findById(waitingAuctions[0].id);
        return { mode: 'ACTIVE', auction: detail, bidderCount, roomName };
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
        
        if (now - auctionEndTime <= FIVE_MINUTES_MS) {
            const detail = await mysqlRepo.findById(latestEnded.id);
            return { mode: 'RESULT', auction: detail, bidderCount, roomName };
        }
    }
    
    return { mode: 'IDLE', auction: null, bidderCount: 0, roomName };
}

async function getAuctionsByMerchantId(merchantId) {
    const auctions = await mysqlRepo.findByMerchantId(merchantId);
    return auctions.map(auction => ({
        id: auction.id,
        name: auction.name,
        imageUrl: auction.image_url,
        startPrice: auction.start_price,
        currentPrice: auction.current_price,
        bidIncrement: auction.bid_increment,
        ceilingPrice: auction.ceiling_price,
        status: auction.status,
        scheduledStartTime: auction.scheduled_start_time,
        scheduledEndTime: auction.scheduled_end_time,
        description: auction.description,
        extendTriggerSeconds: auction.extend_trigger_seconds,
        autoExtendSeconds: auction.auto_extend_seconds,
        maxExtendCount: auction.max_extend_count,
    }));
}

async function cancelAuction(auctionId, reason = '商家紧急取消') {
    const auction = await mysqlRepo.findById(auctionId);
    if (!auction || ['SOLD', 'FAILED', 'CANCELLED'].includes(auction.status)) {
        throw new Error('拍卖不可取消');
    }

    const now = Date.now();
    const updatedAt = time.formatTimeForMySQL(now);
    
    const affectedRows = await mysqlRepo.updateStatusAndPriceWithLock(
        auctionId, 'CANCELLED', auction.current_price, null, auction.version, updatedAt
    );
    
    if (affectedRows === 0) throw new Error('并发修改冲突');
    
    await mysqlRepo.updateById(auctionId, {
        cancel_reason: reason,
        actual_end_time: updatedAt,
        updated_at: updatedAt
    });
    
    await redisRepo.setFields(auctionId, {
        status: 'CANCELLED',
        cancel_reason: reason,
        actual_end_time: now,
        highest_bidder_id: null
    });
    
    await redisRepo.expire(auctionId, 86400);
    
    eventBus.emit(constants.WS_EVENTS.SERVER_BROADCAST.AUCTION_ENDED, {
        roomId: auction.room_id,
        winnerId: null,
        finalPrice: 0,
        status: 'cancelled',
        cancelReason: reason
    });

    return { success: true };
}

async function updateAuction(id, updateData) {
    const auction = await mysqlRepo.findById(id);
    if (!auction || auction.status !== 'WAITING') throw new Error('不可修改');
    
    const updatedAt = time.formatTimeForMySQL(Date.now());
    const fields = { updated_at: updatedAt, version: auction.version + 1 };
    
    if (updateData.startPrice !== undefined) fields.start_price = updateData.startPrice;
    if (updateData.bidIncrement !== undefined) fields.bid_increment = updateData.bidIncrement;
    if (updateData.scheduledStartTime !== undefined) fields.scheduled_start_time = time.formatTimeForMySQL(updateData.scheduledStartTime);
    if (updateData.scheduledEndTime !== undefined) fields.scheduled_end_time = time.formatTimeForMySQL(updateData.scheduledEndTime);
    if (updateData.imageUrl !== undefined) fields.image_url = updateData.imageUrl;
    
    const [result] = await db.getPool().execute(
        `UPDATE auctions SET ${Object.keys(fields).map(k => `${k} = ?`).join(', ')} 
         WHERE id = ? AND version = ?`,
        [...Object.values(fields), id, auction.version]
    );
    
    if (result.affectedRows === 0) throw new Error('冲突');
    
    await redisRepo.removeAuctionKeys(id);
    
    eventBus.emit(constants.WS_EVENTS.SERVER_BROADCAST.ROOM_DISPLAY, {
        roomId: auction.room_id,
        data: await getRoomDisplayState(auction.room_id)
    });
    
    return { id, ...fields };
}

async function getBidHistory(auctionId) {
    const records = await mysqlRepo.findBidHistoryByAuctionId(auctionId, 50);
    return records.map(record => ({
        id: record.id,
        userId: record.user_id,
        amount: Math.round(record.bid_amount / 100),
        time: new Date(record.created_at).toLocaleTimeString()
    }));
}

async function warmupLeaderboardFromMySQL(auctionId) {
    const records = await mysqlRepo.findLeaderboardByAuctionId(auctionId);
    const client = redis.getClient();
    const key = constants.REDIS_KEYS.getLeaderboardZSetKey(auctionId);
    for (const record of records) {
        await client.zAdd(key, { score: record.maxBidAmount, value: String(record.userId) });
    }
    await redisRepo.setLeaderboardWarmed(auctionId, 3600);
}

async function getLeaderboard(auctionId) {
    if (!(await redisRepo.leaderboardExists(auctionId))) {
        await warmupLeaderboardFromMySQL(auctionId);
    }
    
    const leaderboardData = await redisRepo.getLeaderboardFromRedis(auctionId, 10);
    const bidderCount = await redisRepo.getLeaderboardCount(auctionId);
    
    return {
        list: leaderboardData.map(item => ({
            userId: item.userId,
            username: `用户${item.userId}`,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.userId}`,
            maxBidAmount: item.bidAmount,
            bidCount: 1 // TODO: Track bid counts in Redis
        })),
        bidderCount
    };
}

module.exports = {
    initializeAuctionCache,
    warmUpActiveAuctionsCache,
    getAuctionDetail,
    placeBid,
    checkAndSettleAuctions,
    createAuction,
    getActiveAuctionByRoomId,
    getRoomDisplayState,
    getAuctionsByMerchantId,
    cancelAuction,
    updateAuction,
    getBidHistory,
    getLeaderboard
};
