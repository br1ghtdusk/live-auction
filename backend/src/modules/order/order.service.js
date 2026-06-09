const orderRepo = require('./order.repository');
const redisRepo = require('../auction/auction.redis.repository');
const constants = require('../auction/auction.constants');
const logger = require('../../utils/logger');

// 支付定时器 Map
const paymentTimers = new Map();

async function getMerchantOrders(merchantId) {
    try {
        const orders = await orderRepo.findOrdersByMerchantId(merchantId);
        
        const formattedOrders = orders.map(order => ({
            orderId: order.order_id,
            auctionId: order.auction_id,
            merchantId: order.merchant_id,
            winnerId: order.winner_id,
            finalPrice: order.final_price !== null ? (order.final_price / 100).toFixed(2) : null,
            finalPriceFen: order.final_price,
            status: order.status,
            paidAt: order.paid_at,
            createdAt: order.created_at,
            updatedAt: order.updated_at,
            auctionName: order.auction_name || '未知商品',
            auctionImage: order.auction_image || null
        }));

        logger.info(`[Order Service] 查询商家 ${merchantId} 订单列表，共 ${formattedOrders.length} 条`);
        
        return formattedOrders;
    } catch (error) {
        logger.error(`[Order Service] 查询商家订单失败: merchantId=${merchantId}`, error);
        throw error;
    }
}

/**
 * 创建拍卖订单
 * @param {number} auctionId - 拍品ID
 * @param {number} merchantId - 商家ID
 * @param {number} winnerId - 获胜者ID
 * @param {number} finalPrice - 最终价格（分）
 */
async function createOrderForAuction(auctionId, merchantId, winnerId, finalPrice) {
    try {
        await orderRepo.create(auctionId, merchantId, winnerId, finalPrice);
        logger.info(`[Order Service] 订单已创建: auctionId=${auctionId}, winnerId=${winnerId}, price=${finalPrice}`);
    } catch (error) {
        logger.error('[Order Service] 创建订单失败:', error);
        throw error;
    }
}

/**
 * 启动支付超时定时器
 * @param {number} auctionId - 拍品ID
 * @param {number} roomId - 房间ID
 * @param {number} winnerId - 获胜者ID
 * @param {number} finalPrice - 最终价格
 */
function startPaymentTimer(auctionId, roomId, winnerId, finalPrice) {
    if (paymentTimers.has(auctionId)) {
        clearTimeout(paymentTimers.get(auctionId));
        logger.info(`[Order Service] 拍品 ${auctionId} 已存在支付定时器，已清除并重新启动`);
    }

    const timer = setTimeout(async () => {
        logger.info(`[Order Service] 拍品 ${auctionId} 支付超时（${constants.PAYMENT_TIMEOUT_MS}ms），触发流拍`);
        paymentTimers.delete(auctionId);

        // 更新 Redis 支付状态为取消
        await redisRepo.setPaymentStatus(auctionId, constants.PAYMENT_STATUS.CANCELLED);
        logger.info(`[Order Service] Redis 中标记拍品 ${auctionId} 为流拍`);

        // 更新 MySQL 订单状态为取消
        try {
            await orderRepo.updateOrderStatusByAuctionId(auctionId, constants.PAYMENT_STATUS.CANCELLED);
            logger.info(`[Order Service] MySQL 中更新拍品 ${auctionId} 订单状态为 CANCELLED`);
        } catch (error) {
            logger.error(`[Order Service] MySQL 更新订单状态失败：${error.message}`);
        }

        // 广播支付超时事件
        const eventBus = require('../auction/event-bus');
        eventBus.emit('auction_payment_timeout', {
            auctionId,
            roomId,
            winnerId,
            message: '支付超时，商品流拍'
        });
    }, constants.PAYMENT_TIMEOUT_MS);

    paymentTimers.set(auctionId, timer);
    logger.info(`[Order Service] 拍品 ${auctionId} 已启动支付定时器，${constants.PAYMENT_TIMEOUT_MS}ms 后超时`);
}

/**
 * 清除支付定时器
 * @param {number} auctionId - 拍品ID
 */
function clearPaymentTimer(auctionId) {
    const timer = paymentTimers.get(auctionId);
    if (timer) {
        clearTimeout(timer);
        paymentTimers.delete(auctionId);
        logger.info(`[Order Service] 拍品 ${auctionId} 已清除支付定时器`);
        return true;
    }
    return false;
}

/**
 * 处理支付请求
 * @param {number} auctionId - 拍品ID
 * @param {number} userId - 用户ID
 */
async function payOrder(auctionId, userId) {
    logger.info(`[Order Service] 收到支付请求：auctionId=${auctionId}, userId=${userId}`);

    // 从 Redis 获取拍品信息
    const auction = await redisRepo.findById(auctionId);
    if (!auction) {
        logger.warn(`[Order Service] 拍品 ${auctionId} 不存在`);
        return { success: false, code: 'AUCTION_NOT_FOUND', message: '拍品不存在' };
    }

    if (auction.status !== constants.AUCTION_STATUS.SOLD) {
        logger.warn(`[Order Service] 拍品 ${auctionId} 状态为 ${auction.status}，不可支付`);
        return { success: false, code: 'AUCTION_NOT_SOLD', message: '该拍品当前状态不可支付' };
    }

    if (auction.highest_bidder_id !== Number(userId)) {
        logger.warn(`[Order Service] 用户 ${userId} 不是获胜者，真实获胜者=${auction.highest_bidder_id}`);
        return { success: false, code: 'NOT_WINNER', message: '您不是该拍品的获胜者，无权支付' };
    }

    // 检查支付状态
    const currentPaymentStatus = await redisRepo.getPaymentStatus(auctionId);
    if (currentPaymentStatus === constants.PAYMENT_STATUS.PAID) {
        logger.info(`[Order Service] 拍品 ${auctionId} 已支付`);
        return { success: true, message: '该商品已支付' };
    }
    if (currentPaymentStatus === constants.PAYMENT_STATUS.CANCELLED) {
        logger.warn(`[Order Service] 拍品 ${auctionId} 已流拍`);
        return { success: false, code: 'PAYMENT_TIMEOUT', message: '该商品已流拍，无法支付' };
    }

    // 清除支付定时器
    clearPaymentTimer(auctionId);

    // 更新 Redis 支付状态为已支付
    await redisRepo.setPaymentStatus(auctionId, constants.PAYMENT_STATUS.PAID);
    logger.info(`[Order Service] Redis 中标记拍品 ${auctionId} 为已支付`);

    // 更新 MySQL 订单状态为已支付
    try {
        await orderRepo.updateOrderStatusByAuctionId(auctionId, constants.PAYMENT_STATUS.PAID);
        logger.info(`[Order Service] MySQL 中更新拍品 ${auctionId} 订单状态为已支付`);
    } catch (error) {
        logger.warn(`[Order Service] MySQL 更新订单状态失败（不影响 WS 广播）: ${error.message}`);
    }

    // 广播支付成功事件
    const eventBus = require('../auction/event-bus');
    eventBus.emit('auction_paid', {
        auctionId,
        roomId: auction.room_id,
        winnerId: auction.highest_bidder_id,
        price: auction.final_price || auction.current_price
    });

    logger.info(`[Order Service] 支付成功，已广播 auction_paid 事件`);
    return { success: true, message: '支付成功' };
}

module.exports = {
    getMerchantOrders,
    createOrderForAuction,
    startPaymentTimer,
    clearPaymentTimer,
    payOrder
};