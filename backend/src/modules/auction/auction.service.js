const eventBus = require('./event-bus.js');
const mysqlRepo = require('./auction.mysql.repository.js');
const redisRepo = require('./auction.redis.repository.js');
const mapper = require('./auction.mapper.js');
const constants = require('./auction.constants.js');
const auctionEngine = require('../../engines/auction-engine.js');
const settlementEngine = require('../../engines/settlement-engine.js');
const logger = require('../../utils/logger.js');
const time = require('../../utils/time.js');

const MAX_RETRY_ATTEMPTS = 3;

async function initializeAuctionCache(id) {
    try {
        await redisRepo.flushAll();
        logger.info('[Service Cache] 高并发前置全量同步，已强制洗刷 Redis 缓存区');

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
    const lockAcquired = await redisRepo.acquireLock(`${lockKey}:${userId}`, 1000);
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
        const redisData = await redisRepo.findById(auctionId);
        if (!redisData) {
            throw new Error('Auction not found');
        }

        const validation = auctionEngine.validateBid(redisData, bidAmount, now);
        if (!validation.isValid) {
            eventBus.emit(constants.WS_EVENTS.SERVER_BROADCAST.BID_REJECTED, {
                roomId,
                userId,
                reason: validation.reason,
                requiredMinBid: validation.requiredMinBid
            });
            return { success: false, reason: validation.reason };
        }

        const newState = auctionEngine.processBid(redisData, bidAmount, userId, now);

        const fieldsToUpdate = {
            current_price: newState.current_price,
            highest_bidder_id: newState.highest_bidder_id,
            scheduled_end_time: newState.scheduled_end_time,
            extend_count: newState.extend_count,
            status: newState.status,
            version: newState.version
        };

        const isFirstActivation = redisData.status === constants.AUCTION_STATUS.WAITING;

        if (newState.actual_start_time) {
            fieldsToUpdate.actual_start_time = newState.actual_start_time;
        }

        await redisRepo.setFields(auctionId, fieldsToUpdate);

        if (newState.status === 'SOLD') {
            return await handleAuctionSold(roomId, auctionId, newState, userId, now);
        }

        return await handleNormalBid(roomId, auctionId, newState, userId, now, isFirstActivation);
    } finally {
        await redisRepo.releaseLock(`${lockKey}:${userId}`);
    }
}

async function handleAuctionSold(roomId, auctionId, newState, userId, now) {
    const updatedAt = time.formatTimeForMySQL(now);
    const actualEndTime = time.formatTimeForMySQL(now);

    await redisRepo.setFields(auctionId, {
        final_price: newState.final_price,
        actual_end_time: now
    });

    const mysqlAuction = await mysqlRepo.findById(auctionId);
    const version = mysqlAuction ? mysqlAuction.version : 0;

    const affected = await mysqlRepo.updateSettledWithLock(
        auctionId,
        constants.AUCTION_STATUS.SOLD,
        newState.final_price,
        userId,
        actualEndTime,
        version,
        updatedAt
    );

    if (affected === 0) {
        throw new Error('Concurrent modification detected, please retry');
    }

    mysqlRepo.insertBidRecord(
        auctionId,
        userId,
        newState.final_price,
        true,
        updatedAt
    ).catch(err => logger.error('[Service] MySQL insert bid record failed:', err));

    await createOrderForAuction(auctionId, mysqlAuction.merchant_id, userId, newState.final_price, updatedAt);

    eventBus.emit(constants.WS_EVENTS.SERVER_BROADCAST.AUCTION_ENDED, {
        roomId,
        winnerId: userId,
        finalPrice: newState.final_price,
        status: 'sold'
    });

    return { success: true, type: 'auction_ended', winnerId: userId, finalPrice: newState.final_price };
}

async function handleNormalBid(roomId, auctionId, newState, userId, now, isFirstActivation = false) {
    const updatedAt = time.formatTimeForMySQL(now);
    const createdAt = updatedAt;
    const actualStartTime = newState.actual_start_time
        ? time.formatTimeForMySQL(newState.actual_start_time)
        : null;
    const scheduledEndTime = time.formatTimeForMySQL(newState.scheduled_end_time);

    let success = false;
    let attempt = 0;

    while (!success && attempt < MAX_RETRY_ATTEMPTS) {
        attempt++;

        const mysqlAuction = await mysqlRepo.findById(auctionId);
        const version = mysqlAuction ? mysqlAuction.version : 0;

        let affected;
        if (isFirstActivation) {
            affected = await mysqlRepo.activateWithLock(
                auctionId,
                constants.AUCTION_STATUS.BIDDING,
                actualStartTime,
                scheduledEndTime,
                version,
                updatedAt
            );
        } else {
            affected = await mysqlRepo.updateStatusAndPriceWithLock(
                auctionId,
                constants.AUCTION_STATUS.BIDDING,
                newState.current_price,
                userId,
                version,
                updatedAt
            );
        }

        if (affected > 0) {
            success = true;
        } else {
            logger.warn(`[Service] Optimistic lock failed, attempt ${attempt}/${MAX_RETRY_ATTEMPTS}`);
            if (attempt >= MAX_RETRY_ATTEMPTS) {
                throw new Error('Concurrent modification detected, please retry');
            }
            await new Promise(resolve => setTimeout(resolve, 50 * attempt));
        }
    }

    mysqlRepo.insertBidRecord(
        auctionId,
        userId,
        newState.current_price,
        true,
        createdAt
    ).catch(err => logger.error('[Service] MySQL insert bid record failed:', err));

    eventBus.emit(constants.WS_EVENTS.SERVER_BROADCAST.PRICE_CHANGED, {
        roomId,
        currentPrice: newState.current_price,
        highestBidderId: userId,
        endTime: newState.scheduled_end_time,
        extendCount: newState.extend_count
    });

    return { success: true, type: 'price_update' };
}

async function createOrderForAuction(auctionId, merchantId, winnerId, finalPrice, createdAt) {
    try {
        await mysqlRepo.createOrder({
            auction_id: auctionId,
            merchant_id: merchantId,
            winner_id: winnerId,
            final_price: finalPrice,
            status: 'PENDING',
            created_at: createdAt
        });
        logger.info(`[Service] 订单已创建: auctionId=${auctionId}, winnerId=${winnerId}, price=${finalPrice}`);
    } catch (error) {
        logger.error('[Service] 创建订单失败:', error);
        throw error;
    }
}

async function checkAndSettleAuctions() {
    try {
        const auctionId = 1;
        const redisData = await redisRepo.findById(auctionId);
        if (!redisData) return;

        const now = Date.now();
        const isExpired = now >= redisData.scheduled_end_time;
        const isBiddingExpired = redisData.status === constants.AUCTION_STATUS.BIDDING && isExpired;
        const isWaitingExpired = redisData.status === constants.AUCTION_STATUS.WAITING && isExpired;
        
        if ((isBiddingExpired || isWaitingExpired) && !redisData.actual_end_time) {
            logger.info(`[Heartbeat] 守护时钟扫描：捕获到超期未清算商品 (状态: ${redisData.status})，正在激活结算链...`);

            const newState = settlementEngine.settleAuction(redisData, now);

            await redisRepo.setFields(auctionId, {
                status: newState.status,
                final_price: newState.final_price !== null ? newState.final_price : '',
                actual_end_time: newState.actual_end_time
            });

            const actualEndTime = time.formatTimeForMySQL(now);
            const updatedAt = actualEndTime;

            const mysqlAuction = await mysqlRepo.findById(auctionId);
            const version = mysqlAuction ? mysqlAuction.version : 0;

            await mysqlRepo.settle(
                auctionId,
                newState.status,
                newState.final_price || 0,
                newState.highest_bidder_id || 0,
                actualEndTime,
                updatedAt
            );

            if (newState.status === 'SOLD' && newState.highest_bidder_id) {
                await createOrderForAuction(
                    auctionId,
                    mysqlAuction.merchant_id,
                    newState.highest_bidder_id,
                    newState.final_price,
                    updatedAt
                );
            }

            logger.info(`[Heartbeat] 清算落盘完结: 归属状态 -> ${newState.status}`);

            eventBus.emit(constants.WS_EVENTS.SERVER_BROADCAST.AUCTION_ENDED, {
                roomId: 'room_1',
                winnerId: newState.highest_bidder_id,
                finalPrice: newState.final_price,
                status: newState.status.toLowerCase()
            });
        }
    } catch (error) {
        logger.error('[Heartbeat Error] 清算守护任务阻断:', error);
    }
}

module.exports = {
    initializeAuctionCache,
    getAuctionDetail,
    placeBid,
    checkAndSettleAuctions
};