const auctionService = require('./auction.service');
const logger = require('../../utils/logger');

async function getAuctionById(req, res) {
    const { id } = req.params;
    try {
        const auction = await auctionService.getAuctionDetail(parseInt(id, 10));
        if (!auction) {
            return res.status(404).json({ code: 404, message: 'Auction item not found' });
        }
        return res.json({ code: 200, data: auction, message: 'success' });
    } catch (error) {
        logger.error('[Controller Error] getAuctionById:', error);
        return res.status(500).json({ code: 500, message: 'Internal system error' });
    }
}

async function createAuction(req, res) {
    try {
        console.log('【收到发布拍品请求】Body数据为:', req.body);
        const result = await auctionService.createAuction(req.body);
        return res.json({ code: 200, data: result, message: 'success' });
    } catch (error) {
        logger.error('[Controller Error] createAuction:', error);
        return res.status(500).json({ code: 500, message: error.message || 'Internal system error' });
    }
}

async function getAuctions(req, res) {
    try {
        const { merchantId } = req.query;
        if (!merchantId) {
            return res.status(400).json({ code: 400, success: false, message: 'merchantId 参数不能为空' });
        }
        
        const results = await auctionService.getAuctionsByMerchantId(parseInt(merchantId, 10));
        return res.json({ code: 200, success: true, data: results, total: results.length });
    } catch (error) {
        logger.error('[Controller Error] getAuctions:', error);
        return res.status(500).json({ code: 500, success: false, message: error.message || 'Internal system error' });
    }
}

module.exports = {
    getAuctionById,
    createAuction,
    getAuctions
};