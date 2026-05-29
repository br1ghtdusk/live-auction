const auctionService = require('./auction.service');
const logger = require('../../utils/logger');

async function getAuctionById(req, res) {
    const { id } = req.params;
    try {
        const auction = await auctionService.getAuctionDetail(parseInt(id, 10));
        if (!auction) {
            return res.status(404).json({ error: 'Auction item not found' });
        }
        return res.json(auction);
    } catch (error) {
        logger.error('[Controller Error] getAuctionById:', error);
        return res.status(500).json({ error: 'Internal system error' });
    }
}

module.exports = {
    getAuctionById
};