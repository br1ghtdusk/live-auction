const { createClient } = require('redis');
const redisConfig = require('../config/redis');
const logger = require('../utils/logger');

let client = null;

function init() {
    client = createClient({ url: redisConfig.url });
    client.on('error', (err) => logger.error('[Redis Client Error]', err));
}

async function connect() {
    if (!client) init();
    await client.connect();
    logger.info('[Redis] 高速内存数据库物理连接建立成功');
}

function getClient() {
    if (!client) init();
    return client;
}

async function disconnect() {
    if (!client) return;

    if (client.isOpen) {
        await client.quit();
        logger.info('[Redis] Redis连接已关闭');
    }
}

module.exports = { connect, getClient, disconnect };
