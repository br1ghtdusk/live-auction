const redis = require('../../infrastructure/redis.js');
const constants = require('./auction.constants.js');
const mapper = require('./auction.mapper.js');

const BID_LUA_SCRIPT = `
    local key = KEYS[1]
    local bidderId = ARGV[1]
    local bidAmount = tonumber(ARGV[2]) or 0
    local now = tonumber(ARGV[3]) or 0

    local status = redis.call('HGET', key, 'status')
    local currentPrice = tonumber(redis.call('HGET', key, 'current_price')) or 0
    local ceilingPrice = tonumber(redis.call('HGET', key, 'ceiling_price')) or 0
    local scheduledEndTime = tonumber(redis.call('HGET', key, 'scheduled_end_time')) or 0
    local scheduledStartTime = tonumber(redis.call('HGET', key, 'scheduled_start_time')) or 0
    local extendTriggerSeconds = tonumber(redis.call('HGET', key, 'extend_trigger_seconds')) or 10
    local autoExtendSeconds = tonumber(redis.call('HGET', key, 'auto_extend_seconds')) or 10
    local extendCount = tonumber(redis.call('HGET', key, 'extend_count')) or 0
    local maxExtendCount = tonumber(redis.call('HGET', key, 'max_extend_count')) or 99
    local bidIncrement = tonumber(redis.call('HGET', key, 'bid_increment')) or 0

    if not status then
        return cjson.encode({success = false, reason = 'auction_not_found'})
    end

    if scheduledStartTime > 0 and now < scheduledStartTime then
        return cjson.encode({
            success = false, 
            reason = 'auction_not_started',
            debug = {
                now = now,
                scheduledStartTime = scheduledStartTime,
                scheduledEndTime = scheduledEndTime,
                status = status
            }
        })
    end

    if scheduledEndTime > 0 and now > scheduledEndTime then
        return cjson.encode({success = false, reason = 'auction_ended'})
    end

    if status ~= 'BIDDING' and status ~= 'WAITING' then
        return cjson.encode({success = false, reason = 'auction_not_active'})
    end

    if status == 'WAITING' and scheduledStartTime > 0 and now < scheduledStartTime then
        return cjson.encode({success = false, reason = 'auction_not_active'})
    end

    local minValidBid = currentPrice + bidIncrement
    if bidAmount < minValidBid then
        return cjson.encode({success = false, reason = 'bid_too_low', requiredMinBid = minValidBid})
    end

    if ceilingPrice > 0 and bidAmount > ceilingPrice then
        return cjson.encode({success = false, reason = 'exceeds_ceiling', requiredMaxBid = ceilingPrice})
    end

    local isSold = false
    local newEndTime = scheduledEndTime
    local newExtendCount = extendCount
    local newStatus = status

    if ceilingPrice > 0 and bidAmount >= ceilingPrice then
        isSold = true
        newStatus = 'SOLD'
        newEndTime = now
    else
        if scheduledEndTime > 0 then
            local remainingTime = scheduledEndTime - now
            if remainingTime <= extendTriggerSeconds * 1000 and extendCount < maxExtendCount then
                newEndTime = scheduledEndTime + autoExtendSeconds * 1000
                newExtendCount = extendCount + 1
            end
        end

        if status == 'WAITING' then
            newStatus = 'BIDDING'
        end
    end

    local finalBidAmount = isSold and ceilingPrice or bidAmount
    redis.call('HSET', key, 'current_price', tostring(finalBidAmount))
    redis.call('HSET', key, 'highest_bidder_id', tostring(bidderId))
    redis.call('HSET', key, 'scheduled_end_time', tostring(newEndTime))
    redis.call('HSET', key, 'extend_count', tostring(newExtendCount))
    redis.call('HSET', key, 'status', newStatus)

    if newStatus == 'BIDDING' and status == 'WAITING' then
        redis.call('HSET', key, 'actual_start_time', tostring(now))
    end

    if isSold then
        redis.call('HSET', key, 'final_price', tostring(ceilingPrice))
        redis.call('HSET', key, 'actual_end_time', tostring(now))
    end

    return cjson.encode({
        success = true,
        status = newStatus,
        current_price = finalBidAmount,
        highest_bidder_id = bidderId,
        scheduled_end_time = newEndTime,
        extend_count = newExtendCount,
        is_sold = isSold,
        is_first_activation = status == 'WAITING' and newStatus == 'BIDDING'
    })
`;

async function flushAll() {
    return await redis.getClient().flushAll();
}

async function save(id, domain) {
    const key = constants.REDIS_KEYS.getDetailKey(id);
    const hash = mapper.toRedisHash(domain);
    await redis.getClient().hSet(key, hash);
    return key;
}

async function findById(id) {
    const key = constants.REDIS_KEYS.getDetailKey(id);
    const data = await redis.getClient().hGetAll(key);
    return mapper.toDomainFromRedis(data);
}

async function incrementPrice(id, increment) {
    const key = constants.REDIS_KEYS.getDetailKey(id);
    return await redis.getClient().hIncrBy(key, 'current_price', increment);
}

async function setField(id, field, value) {
    const key = constants.REDIS_KEYS.getDetailKey(id);
    await redis.getClient().hSet(key, field, String(value));
}

async function setFields(id, fields) {
    const key = constants.REDIS_KEYS.getDetailKey(id);
    const stringFields = {};
    for (const [k, v] of Object.entries(fields)) {
        stringFields[k] = String(v);
    }
    await redis.getClient().hSet(key, stringFields);
}

async function remove(id) {
    const key = constants.REDIS_KEYS.getDetailKey(id);
    return await redis.getClient().del(key);
}

async function removeAuctionKeys(id) {
    const client = redis.getClient();
    const keys = [
        constants.REDIS_KEYS.getDetailKey(id),
        constants.REDIS_KEYS.getBidsZSetKey(id),
        constants.REDIS_KEYS.getBidLockKey(id),
        constants.REDIS_KEYS.getHighestBidKey(id),
        constants.REDIS_KEYS.getLeaderboardZSetKey(id)  // 新增：删除排行榜 ZSET
    ];
    if (keys.length > 0) {
        await client.del(keys);
    }
    return keys.length;
}

async function expire(id, seconds) {
    const key = constants.REDIS_KEYS.getDetailKey(id);
    return await redis.getClient().expire(key, seconds);
}

async function acquireLock(lockKey, requestId, ttlMs = 1000) {
    const client = redis.getClient();
    const result = await client.set(lockKey, requestId, {
        NX: true,
        PX: ttlMs
    });
    return result === 'OK';
}

async function releaseLock(lockKey, requestId) {
    const client = redis.getClient();
    const luaScript = `
        if redis.call('GET', KEYS[1]) == ARGV[1] then
            return redis.call('DEL', KEYS[1])
        else
            return 0
        end
    `;
    await client.eval(luaScript, {
        keys: [lockKey],
        arguments: [requestId]
    });
}

async function executeBidLua(auctionId, bidderId, bidAmount, now) {
    const client = redis.getClient();
    const key = constants.REDIS_KEYS.getDetailKey(auctionId);
    
    const result = await client.eval(BID_LUA_SCRIPT, {
        keys: [key],
        arguments: [String(bidderId), String(bidAmount), String(now)]
    });
    
    return JSON.parse(result);
}

async function setPaymentStatus(auctionId, status) {
    const key = constants.REDIS_KEYS.getPaymentStatusKey(auctionId);
    const client = redis.getClient();
    await client.set(key, String(status));
    return key;
}

async function getPaymentStatus(auctionId) {
    const key = constants.REDIS_KEYS.getPaymentStatusKey(auctionId);
    const client = redis.getClient();
    const status = await client.get(key);
    return status || null;
}

// ============ 排行榜 ZSET 操作 ============

/**
 * 更新排行榜：将用户出价添加到 ZSET
 * @param {number} auctionId - 拍品ID
 * @param {number} userId - 用户ID
 * @param {number} bidAmount - 出价金额
 */
async function updateLeaderboard(auctionId, userId, bidAmount) {
    const key = constants.REDIS_KEYS.getLeaderboardZSetKey(auctionId);
    const client = redis.getClient();
    // ZADD：如果用户已存在，更新其出价（score）
    await client.zAdd(key, {
        score: bidAmount,
        value: String(userId)
    });
}

/**
 * 获取排行榜前 N 名
 * @param {number} auctionId - 拍品ID
 * @param {number} limit - 返回数量，默认10
 * @returns {Array} - [{ userId, bidAmount }, ...]
 */
async function getLeaderboardFromRedis(auctionId, limit = 10) {
    const key = constants.REDIS_KEYS.getLeaderboardZSetKey(auctionId);
    const client = redis.getClient();
    
    // redis v4 语法：使用 zRange 配合 REV: true 实现倒序，WITH_SCORES 获取分数
    const result = await client.zRange(key, 0, limit - 1, { REV: true, WITH_SCORES: true });
    
    // result 格式为 [userId1, score1, userId2, score2, ...]，需要扁平化处理
    const leaderboard = [];
    for (let i = 0; i < result.length; i += 2) {
        leaderboard.push({
            userId: parseInt(result[i], 10),
            bidAmount: parseFloat(result[i + 1])
        });
    }
    
    return leaderboard;
}

/**
 * 获取排行榜参与人数
 * @param {number} auctionId - 拍品ID
 * @returns {number} - 参与人数
 */
async function getLeaderboardCount(auctionId) {
    const key = constants.REDIS_KEYS.getLeaderboardZSetKey(auctionId);
    const client = redis.getClient();
    const count = await client.zCard(key);
    return count || 0;
}

/**
 * 检查排行榜是否存在
 * @param {number} auctionId - 拍品ID
 * @returns {boolean} - 是否存在
 */
async function leaderboardExists(auctionId) {
    const key = constants.REDIS_KEYS.getLeaderboardZSetKey(auctionId);
    const client = redis.getClient();
    const count = await client.zCard(key);
    return count > 0;
}

/**
 * 删除排行榜
 * @param {number} auctionId - 拍品ID
 */
async function removeLeaderboard(auctionId) {
    const key = constants.REDIS_KEYS.getLeaderboardZSetKey(auctionId);
    const client = redis.getClient();
    await client.del(key);
}

module.exports = {
    flushAll,
    save,
    findById,
    incrementPrice,
    setField,
    setFields,
    remove,
    removeAuctionKeys,
    expire,
    acquireLock,
    releaseLock,
    executeBidLua,
    setPaymentStatus,
    getPaymentStatus,
    updateLeaderboard,
    getLeaderboardFromRedis,
    getLeaderboardCount,
    leaderboardExists,
    removeLeaderboard
};