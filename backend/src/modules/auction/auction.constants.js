const AUCTION_STATUS = {
    WAITING: 'WAITING',
    BIDDING: 'BIDDING',
    SOLD: 'SOLD',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED'
};

const REDIS_KEYS = {
    getDetailKey: (id) => `auction:${id}:detail`,
    getBidsZSetKey: (id) => `auction:${id}:bids`,
    getBidLockKey: (id) => `auction:${id}:bid:lock`,
    getRoomOnlineKey: (roomId) => `room:${roomId}:online`,
    getHighestBidKey: (id) => `auction:${id}:highest_bid`
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
        ROOM_DISPLAY: 'room_display'
    }
};

module.exports = {
    AUCTION_STATUS,
    REDIS_KEYS,
    WS_EVENTS
};