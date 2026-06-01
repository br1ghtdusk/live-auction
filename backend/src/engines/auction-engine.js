const logger = require('../utils/logger');
const time = require('../utils/time');

function validateBid(auction, bidAmount, now) {
    logger.info('[Engine] validateBid 被调用');
    logger.info('[Engine] 商品ID:', auction.id, '当前状态:', auction.status);
    logger.info('[Engine] scheduled_start_time:', time.formatTimeToLocalString(auction.scheduled_start_time));
    logger.info('[Engine] scheduled_end_time:', time.formatTimeToLocalString(auction.scheduled_end_time));
    logger.info('[Engine] actual_start_time:', auction.actual_start_time);
    logger.info('[Engine] actual_end_time:', auction.actual_end_time);

    const statusValidation = validateAuctionStatus(auction.status, auction.scheduled_start_time, auction.scheduled_end_time, now);
    
    if (!statusValidation.isValid) {
        return statusValidation;
    }

    if (auction.status === 'WAITING' && now >= auction.scheduled_start_time) {
        logger.info('[Engine] 判定: 可以激活拍卖');
        return { isValid: true, shouldActivate: true };
    }

    const ceilingCheck = checkCeilingTrigger(bidAmount, auction.ceiling_price);
    if (ceilingCheck.isCeilingTriggered) {
        logger.info('[Engine] 判定: 出价超过封顶价 - 当前价:', auction.current_price, ', 封顶价:', auction.ceiling_price, ', 实际出价:', bidAmount);
        return { isValid: false, reason: 'exceeds_ceiling', requiredMaxBid: auction.ceiling_price };
    }

    const minValidBid = Math.min(auction.current_price + auction.bid_increment, auction.ceiling_price);
    
    if (bidAmount < minValidBid) {
        logger.info('[Engine] 判定: 出价过低 - 当前价:', auction.current_price, ', 最小出价:', minValidBid, ', 实际出价:', bidAmount);
        return { isValid: false, reason: 'bid_too_low', requiredMinBid: minValidBid };
    }

    logger.info('[Engine] 判定: 出价有效');
    return { isValid: true };
}

function processBid(auction, bidAmount, bidderId, now) {
    const newState = { ...auction };

    newState.current_price = bidAmount;
    newState.highest_bidder_id = bidderId;

    if (auction.status === 'WAITING') {
        logger.info('[Engine] processBid: 首次激活 WAITING -> BIDDING');
        logger.info('[Engine] 原始 scheduled_end_time:', time.formatTimeToLocalString(auction.scheduled_end_time));

        newState.status = 'BIDDING';
        newState.actual_start_time = now;
        newState.scheduled_end_time = auction.scheduled_end_time;
        logger.info('[Engine] 严格继承原有结束时间:', time.formatTimeToLocalString(newState.scheduled_end_time));
    } else if (!auction.actual_start_time) {
        newState.actual_start_time = now;
    }

    const ceilingResult = checkCeilingTrigger(bidAmount, auction.ceiling_price);
    if (ceilingResult.isCeilingTriggered) {
        newState.status = 'SOLD';
        newState.final_price = ceilingResult.finalPrice;
        newState.current_price = ceilingResult.finalPrice;
        newState.scheduled_end_time = now;
        return newState;
    }

    const extensionResult = calculateAntiSniperExtension(auction, now);
    newState.scheduled_end_time = extensionResult.newEndTime;
    newState.extend_count = extensionResult.newExtendCount;

    return newState;
}

function validateAuctionStatus(status, scheduledStartTime, scheduledEndTime, now) {
    logger.info('[Engine] validateAuctionStatus 被调用');
    logger.info('[Engine] 当前状态:', status);
    logger.info('[Engine] scheduledStartTime:', time.formatTimeToLocalString(scheduledStartTime));
    logger.info('[Engine] scheduledEndTime:', time.formatTimeToLocalString(scheduledEndTime));

    const nowDigits = String(now).length;
    const startDigits = String(scheduledStartTime).length;
    const endDigits = String(scheduledEndTime).length;
    logger.info('[Engine] 时间戳位数 - now:', nowDigits, ', start:', startDigits, ', end:', endDigits);

    if (nowDigits !== startDigits || nowDigits !== endDigits) {
        logger.warn('[Engine] 时间戳精度不一致!');
    }

    if (now < scheduledStartTime) {
        const diff = scheduledStartTime - now;
        logger.info('[Engine] 判定: auction_not_started - 还剩', Math.floor(diff / 1000), '秒');
        return { isValid: false, reason: 'auction_not_started' };
    }
    if (status !== 'BIDDING' && !(status === 'WAITING' && now >= scheduledStartTime)) {
        logger.info('[Engine] 判定: auction_not_active - 状态:', status);
        return { isValid: false, reason: 'auction_not_active' };
    }
    if (now > scheduledEndTime) {
        const diff = now - scheduledEndTime;
        logger.info('[Engine] 判定: auction_ended - 超时', Math.floor(diff / 1000), '秒');
        return { isValid: false, reason: 'auction_ended' };
    }
    logger.info('[Engine] 判定: 状态有效');
    return { isValid: true };
}

function checkCeilingTrigger(expectedPrice, ceilingPrice) {
    if (expectedPrice >= ceilingPrice) {
        return { isCeilingTriggered: true, finalPrice: ceilingPrice };
    }
    return { isCeilingTriggered: false, finalPrice: expectedPrice };
}

function calculateAntiSniperExtension(auction, now) {
    const remainingTime = auction.scheduled_end_time - now;

    if (remainingTime <= auction.extend_trigger_seconds * 1000 &&
        auction.extend_count < auction.max_extend_count) {
        return {
            isExtended: true,
            newEndTime: auction.scheduled_end_time + auction.auto_extend_seconds * 1000,
            newExtendCount: auction.extend_count + 1
        };
    }

    return {
        isExtended: false,
        newEndTime: auction.scheduled_end_time,
        newExtendCount: auction.extend_count
    };
}

module.exports = {
    validateBid,
    processBid,
    validateAuctionStatus,
    checkCeilingTrigger,
    calculateAntiSniperExtension
};
