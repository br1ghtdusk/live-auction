const eventBus = require('./event-bus.js');
const logger = require('../../utils/logger.js');

let auctionService = null;

function setAuctionService(service) {
    auctionService = service;
}

async function handleConnection(ws, roomId) {
    if (typeof roomId !== 'number' || isNaN(roomId) || roomId <= 0) {
        logger.error(`[WS Gate] 无效的 roomId: ${roomId}，拒绝处理`);
        ws.close(1008, 'Invalid roomId');
        return;
    }

    try {
        const auction = await auctionService.getActiveAuctionByRoomId(roomId);
        if (auction) {
            ws.send(JSON.stringify({
                type: 'auction_info',
                data: auction
            }));
        }
    } catch (error) {
        logger.error('[WS Gate] 送达客户端首屏初始缓存失败:', error);
    }
}

async function handleMessage(ws, roomId, data) {
    if (data.type && data.type.toLowerCase() === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
    }

    if (data.action === 'bid') {
        try {
            const auctionId = data.auctionId;
            await auctionService.placeBid(roomId, auctionId, data);
        } catch (error) {
            logger.error('[WS Gate] 处理出价异常:', error);
            ws.send(JSON.stringify({
                type: 'bid_error',
                data: { reason: error.message }
            }));
        }
    }
}

function init() {
    eventBus.on('ws:connection', async ({ ws, roomId }) => {
        await handleConnection(ws, roomId);
    });

    eventBus.on('ws:message', async ({ ws, roomId, data }) => {
        await handleMessage(ws, roomId, data);
    });

    logger.info('[Auction WS] 拍卖消息处理器初始化完成');
}

module.exports = {
    init,
    setAuctionService,
    handleConnection,
    handleMessage
};