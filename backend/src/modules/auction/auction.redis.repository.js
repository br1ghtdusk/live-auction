const redis = require('../../infrastructure/redis.js');
const constants = require('./auction.constants.js');
const mapper = require('./auction.mapper.js');

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
        args: [requestId]
    });
}

module.exports = {
    flushAll,
    save,
    findById,
    incrementPrice,
    setField,
    setFields,
    remove,
    expire,
    acquireLock,
    releaseLock
};