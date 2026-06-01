const orderRepo = require('./order.repository');
const logger = require('../../utils/logger');

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

module.exports = {
    getMerchantOrders
};