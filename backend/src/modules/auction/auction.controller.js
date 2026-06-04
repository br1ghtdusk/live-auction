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

async function cancelAuction(req, res) {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        
        if (!id) {
            return res.status(400).json({ code: 400, success: false, message: '拍卖 ID 不能为空' });
        }
        
        await auctionService.cancelAuction(parseInt(id, 10), reason);
        return res.json({ code: 200, success: true, message: '拍卖已成功取消' });
    } catch (error) {
        logger.error('[Controller Error] cancelAuction:', error);
        return res.status(500).json({ code: 500, success: false, message: error.message || 'Internal system error' });
    }
}

async function updateAuction(req, res) {
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        if (!id) {
            return res.status(400).json({ code: 400, success: false, message: '拍卖 ID 不能为空' });
        }
        
        const result = await auctionService.updateAuction(parseInt(id, 10), updateData);
        return res.json({ code: 200, success: true, data: result, message: '拍品规则更新成功' });
    } catch (error) {
        logger.error('[Controller Error] updateAuction:', error);
        
        // 如果是业务校验错误（如状态不允许修改），返回 400
        if (error.message && error.message.includes('只有未开始')) {
            return res.status(400).json({ code: 400, success: false, message: error.message });
        }
        
        return res.status(500).json({ code: 500, success: false, message: error.message || 'Internal system error' });
    }
}

async function getBidHistory(req, res) {
    try {
        const { auctionId } = req.params;
        
        if (!auctionId) {
            return res.status(400).json({ code: 400, success: false, message: '拍卖 ID 不能为空' });
        }
        
        const history = await auctionService.getBidHistory(parseInt(auctionId, 10));
        return res.json({ code: 200, success: true, data: history });
    } catch (error) {
        logger.error('[Controller Error] getBidHistory:', error);
        return res.status(500).json({ code: 500, success: false, message: error.message || 'Internal system error' });
    }
}

module.exports = {
    getAuctionById,
    createAuction,
    getAuctions,
    cancelAuction,
    updateAuction,
    getBidHistory
};