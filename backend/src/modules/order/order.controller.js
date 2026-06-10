const orderService = require('./order.service');

async function getMerchantOrders(req, res) {
    try {
        const { merchantId } = req.query;

        if (!merchantId) {
            return res.status(400).json({
                success: false,
                error: 'merchantId 参数不能为空'
            });
        }

        const parsedMerchantId = parseInt(merchantId, 10);
        if (isNaN(parsedMerchantId) || parsedMerchantId <= 0) {
            return res.status(400).json({
                success: false,
                error: 'merchantId 必须是正整数'
            });
        }

        const orders = await orderService.getMerchantOrders(parsedMerchantId);

        return res.json({
            code: 200,
            success: true,
            data: orders,
            total: orders.length
        });
    } catch (error) {
        console.error('[Order Controller] 获取商家订单列表失败:', error);
        return res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
}

async function payOrder(req, res) {
    try {
        const { auctionId, userId, roomId } = req.body;

        if (!auctionId || !userId) {
            return res.status(400).json({
                success: false,
                code: 'MISSING_PARAMS',
                message: '缺少必要参数：auctionId 或 userId'
            });
        }

        const result = await orderService.payOrder(parseInt(auctionId, 10), parseInt(userId, 10));

        if (!result.success) {
            return res.status(400).json({
                success: false,
                code: result.code,
                message: result.message
            });
        }

        return res.json({
            success: true,
            code: 200,
            message: result.message
        });
    } catch (error) {
        console.error('[Order Controller] payOrder 失败:', error);
        return res.status(500).json({
            success: false,
            code: 500,
            message: 'Internal system error'
        });
    }
}

module.exports = {
    getMerchantOrders,
    payOrder,
};