const eventBus = require('./event-bus.js');
const mysqlRepo = require('./auction.mysql.repository.js');
const redisRepo = require('./auction.redis.repository.js');
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

                // 必须 await 插入记录，否则接下来的 getLeaderboard 可能读不到最新数据
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

        // 等待同步完成后再获取排行榜，确保数据实时性
        await syncToMySQL();

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

        // 获取最新排行榜和出价人数
        const leaderboardData = await getLeaderboard(auctionId);
        logger.info(`[Service] 实时同步数据: auctionId=${auctionId}, bidderCount=${leaderboardData.bidderCount}, listSize=${leaderboardData.list.length}`);

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

                // 检查是否到达开始时间但仍处于 WAITING 状态
                const shouldActivate = 
                    redisData.status === constants.AUCTION_STATUS.WAITING &&
                    now >= redisData.scheduled_start_time && 
                    now < redisData.scheduled_end_time;

                if (shouldActivate) {
                    logger.info(`[Heartbeat] 守护时钟扫描：捕获到到达开始时间的拍品 ID=${auctionId} (房间: ${roomId})，自动激活为 BIDDING 状态...`);
                    
                    // 更新 Redis 状态
                    await redisRepo.setFields(auctionId, {
                        status: constants.AUCTION_STATUS.BIDDING,
                        actual_start_time: now.toString()
                    });
                    
                    // 更新 MySQL 状态
                    const mysqlAuction = await mysqlRepo.findById(auctionId);
                    if (mysqlAuction) {
                        const actualStartTime = time.formatTimeForMySQL(now);
                        const updatedAt = actualStartTime;
                        await mysqlRepo.updateStatus(auctionId, constants.AUCTION_STATUS.BIDDING, updatedAt);
                    }
                    
                    logger.info(`[Heartbeat] 拍品 ${auctionId} 已自动激活为 BIDDING 状态`);
                    
                    // 广播状态变更
                    eventBus.emit(constants.WS_EVENTS.SERVER_BROADCAST.ROOM_DISPLAY_UPDATE, {
                        roomId: roomId
                    });
                    
                    continue; // 跳过后续处理，继续下一个拍品
                }

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
        roomId,  
        merchantId,  
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
    logger.info(`[Service] 新拍品创建成功，ID: ${auctionId}`);

    return { id: auctionId };
}

async function getRoomDisplayState(roomId) {
    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    const now = Date.now();
    
    // 获取最近10条数据（放大限制防止预售商品过多导致当前商品被挤出）
    const auctions = await mysqlRepo.findByRoomId(roomId, 10, 0);
    
    if (auctions.length === 0) {
        logger.info(`[Service] 房间 ${roomId} 没有任何拍品记录`);
        return { mode: 'IDLE', auction: null, bidderCount: 0 };
    }
    
    // 获取当前参拍人数
    const targetAuction = auctions.find(a => a.status === 'BIDDING') || auctions[0];
    const leaderboardData = await getLeaderboard(targetAuction.id);
    const bidderCount = leaderboardData.bidderCount;

    // 第一步：查找是否存在状态为 'BIDDING' 的拍品
    const biddingAuction = auctions.find(a => a.status === 'BIDDING');
    if (biddingAuction) {
        let detail = await mysqlRepo.findById(biddingAuction.id);
        
        // 🌟 关键修复：从 Redis 获取实时价格，确保与当前出价一致
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
            logger.warn(`[Service] Redis读取失败，使用MySQL数据: ${e.message}`);
        }
        
        logger.info(`[Service] 房间 ${roomId} 找到进行中的拍品 ID: ${biddingAuction.id}`);
        return { mode: 'ACTIVE', auction: detail, bidderCount };
    }
    
    // 第二步：查找所有状态为 'WAITING' 的拍品，取最临近开始的那一件
    const waitingAuctions = auctions.filter(a => a.status === 'WAITING');
    if (waitingAuctions.length > 0) {
        // 按 scheduled_start_time 升序排序，取最临近开始的
        waitingAuctions.sort((a, b) => 
            new Date(a.scheduled_start_time).getTime() - new Date(b.scheduled_start_time).getTime()
        );
        const nearestWaiting = waitingAuctions[0];
        const detail = await mysqlRepo.findById(nearestWaiting.id);
        logger.info(`[Service] 房间 ${roomId} 找到即将开始的拍品 ID: ${nearestWaiting.id}`);
        return { mode: 'ACTIVE', auction: detail, bidderCount };
    }
    
    // 第三步：查找历史结束的拍品，执行 5 分钟缓冲期判定
    const endedAuctions = auctions.filter(a => 
        ['SOLD', 'FAILED', 'CANCELLED'].includes(a.status)
    );
    
    if (endedAuctions.length > 0) {
        // 按 ID 降序排序，取最新结束的
        endedAuctions.sort((a, b) => b.id - a.id);
        const latestEnded = endedAuctions[0];
        
        // 计算拍品结束时间：优先使用 actual_end_time，否则使用 scheduled_end_time
        const auctionEndTime = latestEnded.actual_end_time 
            ? new Date(latestEnded.actual_end_time).getTime()
            : new Date(latestEnded.scheduled_end_time).getTime();
        
        // 检查结束时间是否在5分钟内
        const timeSinceEnd = now - auctionEndTime;
        
        if (timeSinceEnd <= FIVE_MINUTES_MS) {
            const detail = await mysqlRepo.findById(latestEnded.id);
            logger.info(`[Service] 房间 ${roomId} 找到刚结束的拍品 ID: ${latestEnded.id}，结束于 ${Math.floor(timeSinceEnd / 1000)} 秒前`);
            return { mode: 'RESULT', auction: detail, bidderCount };
        }
        
        logger.info(`[Service] 房间 ${roomId} 最新拍品已结束超过 5 分钟`);
    }
    
    // 第四步：以上皆无，返回 IDLE
    logger.info(`[Service] 房间 ${roomId} 处于 IDLE 状态`);
    return { mode: 'IDLE', auction: null, bidderCount: 0 };
}

async function getActiveAuctionByRoomId(roomId) {
    const displayState = await getRoomDisplayState(roomId);
    return displayState.mode !== 'IDLE' ? displayState.auction : null;
}

async function getAuctionsByMerchantId(merchantId) {
    // 查询指定商家的所有拍品
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
    if (!auction) {
        throw new Error('拍卖不存在');
    }
    
    if (auction.status === 'SOLD' || auction.status === 'FAILED' || auction.status === 'CANCELLED') {
        throw new Error('拍卖已结束，无法取消');
    }

    const now = Date.now();
    const updatedAt = time.formatTimeForMySQL(now);
    const actualEndTime = time.formatTimeForMySQL(now);
    
    // 获取当前版本号
    const version = auction.version;
    
    // 使用乐观锁更新
    const affectedRows = await mysqlRepo.updateStatusAndPriceWithLock(
        auctionId,
        'CANCELLED',
        auction.current_price,
        null,
        version,
        updatedAt
    );
    
    // 检查乐观锁结果
    if (affectedRows === 0) {
        throw new Error('数据已被他人修改，请刷新后重试');
    }
    
    // 更新取消原因字段
    await mysqlRepo.updateById(auctionId, {
        cancel_reason: reason,
        actual_end_time: actualEndTime,
        updated_at: updatedAt
    });
    
    // 原子操作更新 Redis 缓存，防止并发击穿
    await redisRepo.setFields(auctionId, {
        status: 'CANCELLED',
        cancel_reason: reason,
        actual_end_time: now,
        highest_bidder_id: null
    });
    
    // 设置 24 小时过期时间，防止缓存雪崩
    const TTL_SECONDS = 86400;
    await redisRepo.expire(auctionId, TTL_SECONDS);
    
    logger.info(`[Service] 拍卖 ${auctionId} 已取消，Redis 缓存已原子更新并设置 TTL: ${TTL_SECONDS} 秒`);
    
    // 通过 eventBus 广播取消消息
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
    // 1. 查询拍品
    const auction = await mysqlRepo.findById(id);
    if (!auction) {
        throw new Error('拍品不存在');
    }
    
    // 2. 核心校验：只有 WAITING 状态才允许修改
    if (auction.status !== 'WAITING') {
        throw new Error('只有未开始(WAITING)的竞拍才允许修改规则');
    }
    
    const now = Date.now();
    const updatedAt = time.formatTimeForMySQL(now);
    
    // 3. 获取当前版本号
    const version = auction.version;
    
    // 4. 构建更新字段（包含版本检查）
    const fields = { 
        updated_at: updatedAt,
        version: version + 1  // 版本自增
    };
    
    // 可更新的字段
    if (updateData.startPrice !== undefined) fields.start_price = updateData.startPrice;
    if (updateData.currentPrice !== undefined) fields.current_price = updateData.currentPrice;
    if (updateData.bidIncrement !== undefined) fields.bid_increment = updateData.bidIncrement;
    if (updateData.ceilingPrice !== undefined) fields.ceiling_price = updateData.ceilingPrice;
    if (updateData.scheduledStartTime !== undefined) fields.scheduled_start_time = time.formatTimeForMySQL(updateData.scheduledStartTime);
    if (updateData.scheduledEndTime !== undefined) fields.scheduled_end_time = time.formatTimeForMySQL(updateData.scheduledEndTime);
    if (updateData.description !== undefined) fields.description = updateData.description;
    if (updateData.extendTriggerSeconds !== undefined) fields.extend_trigger_seconds = updateData.extendTriggerSeconds;
    if (updateData.autoExtendSeconds !== undefined) fields.auto_extend_seconds = updateData.autoExtendSeconds;
    if (updateData.maxExtendCount !== undefined) fields.max_extend_count = updateData.maxExtendCount;
    if (updateData.imageUrl !== undefined) fields.image_url = updateData.imageUrl;
    
    // 5. 使用乐观锁执行数据库更新
    const [result] = await db.getPool().execute(
        `UPDATE auctions SET ${Object.keys(fields).map(k => `${k} = ?`).join(', ')} 
         WHERE id = ? AND version = ?`,
        [...Object.values(fields), id, version]
    );
    
    // 6. 检查乐观锁结果
    if (result.affectedRows === 0) {
        throw new Error('数据已被他人修改，请刷新后重试');
    }
    
    logger.info(`[Service] 拍品 ${id} 规则更新成功`);
    
    // 7. 同步 Redis 缓存（删除缓存，下次查询会重新从 MySQL 加载）
    await redisRepo.removeAuctionKeys(id);
    
    // 8. 广播 WebSocket 更新通知
    const displayState = await getRoomDisplayState(auction.room_id);
    eventBus.emit(constants.WS_EVENTS.SERVER_BROADCAST.ROOM_DISPLAY, {
        roomId: auction.room_id,
        data: displayState
    });
    
    return { id, ...fields };
}

async function getBidHistory(auctionId) {
    const records = await mysqlRepo.findBidHistoryByAuctionId(auctionId, 50);
    return records.map(record => ({
        id: record.id,
        userId: record.user_id,
        amount: Math.round(record.bid_amount / 100),  // 转换为元并四舍五入
        time: new Date(record.created_at).toLocaleTimeString()
    }));
}

/**
 * 获取拍品的出价排行榜（前5名）
 * @param {number} auctionId - 拍品ID
 * @returns {Array} - 排行榜数据
 */
async function getLeaderboard(auctionId) {
    const records = await mysqlRepo.findLeaderboardByAuctionId(auctionId);
    
    // 获取唯一参与人数
    const [rows] = await db.getPool().query(
        `SELECT COUNT(DISTINCT user_id) AS bidderCount FROM bid_records WHERE auction_id = ?`,
        [auctionId]
    );
    const bidderCount = rows[0]?.bidderCount || 0;

    return {
        list: records.map(record => ({
            userId: record.userId,
            username: `用户${record.userId}`,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${record.userId}`,
            maxBidAmount: record.maxBidAmount,
            bidCount: record.bidCount
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