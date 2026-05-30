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
        const result = await auctionService.createAuction(req.body);
        return res.json({ code: 200, data: result, message: 'success' });
    } catch (error) {
        logger.error('[Controller Error] createAuction:', error);
        return res.status(500).json({ code: 500, message: error.message || 'Internal system error' });
    }
}

module.exports = {
    getAuctionById,
    createAuction
};