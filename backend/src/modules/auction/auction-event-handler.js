const eventBus = require('./event-bus.js');
const constants = require('./auction.constants.js');
const logger = require('../../utils/logger.js');

const WS_EVENTS = constants.WS_EVENTS.SERVER_BROADCAST;

let wss = null;
let auctionService = null;

function setWss(wsModule) {
    wss = wsModule;
}

function setAuctionService(service) {
    auctionService = service;
}

function handlePriceUpdate(data) {
    if (!wss) return;
    wss.broadcast(data.roomId, {
        type: WS_EVENTS.PRICE_CHANGED,
        data: {
            currentPrice: data.currentPrice,
            highestBidderId: data.highestBidderId,
            endTime: data.endTime,
            extendCount: data.extendCount,
            bidderCount: data.bidderCount,
            leaderboardList: data.leaderboardList
        }
    });
}

async function handleAuctionEnded(data) {
    if (!wss) return;
    
    // 广播 auction_ended 消息
    wss.broadcast(data.roomId, {
        type: WS_EVENTS.AUCTION_ENDED,
        data: {
            winnerId: data.winnerId,
            finalPrice: data.finalPrice,
            status: data.status,
            cancelReason: data.cancelReason
        }
    });
    
    // 广播最新的 room_display 状态
    if (auctionService) {
        try {
            const displayState = await auctionService.getRoomDisplayState(data.roomId);
            wss.broadcast(data.roomId, {
                type: 'room_display',
                data: displayState
            });
        } catch (error) {
            logger.error('[EventHandler] 获取房间显示状态失败:', error);
        }
    }
}

function handleBidRejected(data) {
    if (!wss) return;
    wss.broadcast(data.roomId, {
        type: WS_EVENTS.BID_REJECTED,
        data: {
            userId: data.userId,
            reason: data.reason,
            requiredMinBid: data.requiredMinBid
        }
    });
}

async function handleRoomDisplay(data) {
    if (!wss) return;
    
    const { roomId, data: displayState } = data;
    wss.broadcast(roomId, {
        type: WS_EVENTS.ROOM_DISPLAY,
        data: displayState
    });
}

// 处理房间状态更新广播（用于自动激活拍品后通知所有客户端）
async function handleRoomDisplayUpdate(data) {
    if (!wss || !auctionService) return;
    
    const { roomId } = data;
    try {
        const displayState = await auctionService.getRoomDisplayState(roomId);
        wss.broadcast(roomId, {
            type: 'room_display',
            data: displayState
        });
        logger.info(`[EventHandler] 已广播房间 ${roomId} 状态更新: ${displayState.mode}`);
    } catch (error) {
        logger.error('[EventHandler] 获取房间显示状态失败:', error);
    }
}

function init() {
    eventBus.on(WS_EVENTS.PRICE_CHANGED, handlePriceUpdate);
    eventBus.on(WS_EVENTS.AUCTION_ENDED, handleAuctionEnded);
    eventBus.on(WS_EVENTS.BID_REJECTED, handleBidRejected);
    eventBus.on(WS_EVENTS.ROOM_DISPLAY, handleRoomDisplay);
    eventBus.on(WS_EVENTS.ROOM_DISPLAY_UPDATE, handleRoomDisplayUpdate);  // ：监听状态更新广播
    logger.info('[EventHandler] 拍卖事件监听器初始化完成');
}

module.exports = {
    init,
    setWss,
    setAuctionService,
    handlePriceUpdate,
    handleAuctionEnded,
    handleBidRejected
};
