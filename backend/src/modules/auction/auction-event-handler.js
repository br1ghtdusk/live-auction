const eventBus = require('./event-bus.js');
const constants = require('./auction.constants.js');
const logger = require('../../utils/logger.js');

const WS_EVENTS = constants.WS_EVENTS.SERVER_BROADCAST;

let wss = null;

function setWss(wsModule) {
    wss = wsModule;
}

function handlePriceUpdate(data) {
    if (!wss) return;
    wss.broadcast(data.roomId, {
        type: WS_EVENTS.PRICE_CHANGED,
        data: {
            currentPrice: data.currentPrice,
            highestBidderId: data.highestBidderId,
            endTime: data.endTime,
            extendCount: data.extendCount
        }
    });
}

function handleAuctionEnded(data) {
    if (!wss) return;
    wss.broadcast(data.roomId, {
        type: WS_EVENTS.AUCTION_ENDED,
        data: {
            winnerId: data.winnerId,
            finalPrice: data.finalPrice,
            status: data.status
        }
    });
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

function init() {
    eventBus.on(WS_EVENTS.PRICE_CHANGED, handlePriceUpdate);
    eventBus.on(WS_EVENTS.AUCTION_ENDED, handleAuctionEnded);
    eventBus.on(WS_EVENTS.BID_REJECTED, handleBidRejected);
    logger.info('[EventHandler] 拍卖事件监听器初始化完成');
}

module.exports = {
    init,
    setWss,
    handlePriceUpdate,
    handleAuctionEnded,
    handleBidRejected
};