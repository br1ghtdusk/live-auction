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

module.exports = {
    getMerchantOrders
};