const eventBus = require('./event-bus.js');
const logger = require('../../utils/logger.js');

let auctionService = null;

function setAuctionService(service) {
    auctionService = service;
}

async function handleConnection(ws, roomId) {
    try {
        const auction = await auctionService.getAuctionDetail(1);
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
    if (data.action === 'bid') {
        try {
            await auctionService.placeBid(roomId, 1, data);
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