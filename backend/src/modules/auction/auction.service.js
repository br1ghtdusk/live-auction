const eventBus = require('./event-bus.js');
const mysqlRepo = require('./auction.mysql.repository.js');
const redisRepo = require('./auction.redis.repository.js');
const mapper = require('./auction.mapper.js');
const constants = require('./auction.constants.js');
const auctionEngine = require('../../engines/auction-engine.js');
const settlementEngine = require('../../engines/settlement-engine.js');
const logger = require('../../utils/logger.js');
const time = require('../../utils/time.js');

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
            if (luaResult.debug) {
                logger.warn(`[Service] Debug 信息: now=${luaResult.debug.now}, scheduledStartTime=${luaResult.debug.scheduledStartTime}, scheduledEndTime=${luaResult.debug.scheduledEndTime}, status=${luaResult.debug.status}`);
            }
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

        async function syncToMySQL() {
            const updatedAt = time.formatTimeForMySQL(now);
            
            try {
                const mysqlAuction = await mysqlRepo.findById(auctionId);
                if (!mysqlAuction) {
                    logger.error(`[Service] MySQL 同步失败，商品不存在: auctionId=${auctionId}`);
                    return;
                }

                const version = mysqlAuction.version;
                const currentPrice = updatedAuction.current_price;
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

                    await createOrderForAuction(auctionId, mysqlAuction.merchant_id, highestBidderId, currentPrice, updatedAt);
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

                mysqlRepo.insertBidRecord(
                    auctionId,
                    userId,
                    currentPrice,
                    updatedAt
                ).catch(err => logger.error('[Service] MySQL insert bid record failed:', err));

                logger.info(`[Service] MySQL 同步完成: auctionId=${auctionId}, price=${currentPrice}`);
            } catch (syncError) {
                logger.error(`[Service] MySQL 同步异常: auctionId=${auctionId}`, syncError);
            }
        }

        syncToMySQL().catch(err => logger.error('[Service] MySQL 异步同步失败:', err));

        if (is_sold) {
            const TTL_SECONDS = 86400;
            await redisRepo.expire(auctionId, TTL_SECONDS);
            logger.info(`[Service] 已为一口价成交商品 ${auctionId} 设置 TTL 过期时间: ${TTL_SECONDS} 秒 (24小时)`);
            
            eventBus.emit(constants.WS_EVENTS.SERVER_BROADCAST.AUCTION_ENDED, {
                roomId,
                winnerId: updatedAuction.highest_bidder_id,
                finalPrice: updatedAuction.current_price,
                status: 'sold'
            });
            return { success: true, type: 'auction_ended', winnerId: updatedAuction.highest_bidder_id, finalPrice: updatedAuction.current_price };
        }

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
            ceiling_price: updatedAuction.ceiling_price
        });

        return { success: true, type: 'price_update' };
    } finally {
        await redisRepo.releaseLock(`${lockKey}:${userId}`, requestId);
    }
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
                    logger.info(`[Heartbeat] 拍卖 ${auctionId} Redis 缓存未命中，尝试从 MySQL 回源`);
                    const mysqlAuction = await mysqlRepo.findById(auctionId);
                    if (!mysqlAuction) {
                        logger.warn(`[Heartbeat] 拍卖 ${auctionId} 在 MySQL 中也不存在，跳过`);
                        continue;
                    }
                    redisData = mapper.toDomainFromMysql(mysqlAuction);
                    await redisRepo.save(auctionId, redisData);
                    logger.info(`[Heartbeat] 拍卖 ${auctionId} MySQL 回源成功并已预热 Redis`);
                }

                const isExpired = now >= redisData.scheduled_end_time;
                const isBiddingExpired = redisData.status === constants.AUCTION_STATUS.BIDDING && isExpired;
                const isWaitingExpired = redisData.status === constants.AUCTION_STATUS.WAITING && isExpired;

                if ((isBiddingExpired || isWaitingExpired) && !redisData.actual_end_time) {
                    logger.info(`[Heartbeat] 守护时钟扫描：捕获到超期未清算商品 ID=${auctionId} (状态: ${redisData.status}，房间: ${roomId})，正在激活结算链...`);

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

                    logger.info(`[Heartbeat] 清算落盘完结: auctionId=${auctionId}，roomId=${roomId}，归属状态 -> ${newState.status}`);

                    await redisRepo.save(auctionId, newState);
                    
                    const TTL_SECONDS = 86400;
                    await redisRepo.expire(auctionId, TTL_SECONDS);
                    logger.info(`[Heartbeat] 已为结算商品 ${auctionId} 设置 TTL 过期时间: ${TTL_SECONDS} 秒 (24小时)`);

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
        name,
        imageUrl,
        startPrice,
        bidIncrement,
        duration,
        ceilingPrice,
        scheduledStartTime,
        scheduledEndTime,
        description,
        extendTriggerSeconds,
        autoExtendSeconds,
        maxExtendCount,
        roomId,  // 新增 roomId 接收
        merchantId,  // 新增 merchantId 接收
    } = payload;

    const auctionData = {
        merchant_id: parseInt(merchantId, 10) || 1001,
        room_id: roomId ?? 101,  // 透传 roomId，默认 101
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
    logger.info(`[Service] 新拍品创建成功，ID: ${auctionId}`);

    return { id: auctionId };
}

async function getActiveAuctionByRoomId(roomId) {
    // 获取指定房间最新的拍卖（无论状态）
    const auctions = await mysqlRepo.findByRoomId(roomId, 1, 0);
    if (!auctions || auctions.length === 0) return null;
    return await mysqlRepo.findById(auctions[0].id);
}

async function getAuctionsByMerchantId(merchantId) {
    // 查询指定商家的所有拍品
    const auctions = await mysqlRepo.findByMerchantId(merchantId);
    return auctions.map(auction => ({
        id: auction.id,
        name: auction.name,
        imageUrl: auction.image_url || null,
        startPrice: auction.start_price,
        currentPrice: auction.current_price,
        status: auction.status,
        scheduledStartTime: auction.scheduled_start_time,
        scheduledEndTime: auction.scheduled_end_time,
    }));
}

module.exports = {
    initializeAuctionCache,
    warmUpActiveAuctionsCache,
    getAuctionDetail,
    placeBid,
    checkAndSettleAuctions,
    createAuction,
    getActiveAuctionByRoomId,
    getAuctionsByMerchantId
};