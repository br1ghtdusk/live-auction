const AUCTION_STATUS = {
    WAITING: 'WAITING',
    BIDDING: 'BIDDING',
    SOLD: 'SOLD',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED'
};

const PAYMENT_STATUS = {
    PENDING: 'PENDING',
    PAID: 'PAID',
    CANCELLED: 'CANCELLED',
    REFUNDED: 'REFUNDED'
};

const PAYMENT_TIMEOUT_MS = 60 * 1000; // 60秒支付超时

const REDIS_KEYS = {
    getDetailKey: (id) => `auction:${id}:detail`,
    getBidsZSetKey: (id) => `auction:${id}:bids`,
    getBidLockKey: (id) => `auction:${id}:bid:lock`,
    getRoomOnlineKey: (roomId) => `room:${roomId}:online`,
    getHighestBidKey: (id) => `auction:${id}:highest_bid`,
    getPaymentStatusKey: (id) => `auction:${id}:payment_status`,
    getPaymentTimeoutKey: (id) => `auction:${id}:payment_timeout`,
    getLeaderboardZSetKey: (id) => `auction:${id}:leaderboard`  // 新增：排行榜 ZSET
};

const WS_EVENTS = {
    CLIENT_ACTION: {
        JOIN: 'join',
        BID: 'bid',
        LEAVE: 'leave',
        HEARTBEAT: 'heartbeat'
    },
    SERVER_BROADCAST: {
        PRICE_CHANGED: 'price_update',
        AUCTION_EXTENDED: 'auction_extended',
        AUCTION_SOLD: 'auction_sold',
        AUCTION_ENDED: 'auction_ended',
        BIZ_ERROR: 'biz_error',
        AUCTION_INFO: 'auction_info',
        BID_REJECTED: 'bid_rejected',
        ROOM_DISPLAY: 'room_display',
        ROOM_DISPLAY_UPDATE: 'room_display_update',
        AUCTION_PAID: 'AUCTION_PAID',
        AUCTION_PAYMENT_TIMEOUT: 'AUCTION_PAYMENT_TIMEOUT'
    }
};

module.exports = {
    AUCTION_STATUS,
    PAYMENT_STATUS,
    PAYMENT_TIMEOUT_MS,
    REDIS_KEYS,
    WS_EVENTS
};