const express = require('express');
const router = express.Router();
const auctionController = require('./auction.controller');

router.get('/', auctionController.getAuctions);
router.get('/:id', auctionController.getAuctionById);
router.post('/', auctionController.createAuction);
router.put('/:id', auctionController.updateAuction);
router.post('/:id/cancel', auctionController.cancelAuction);
router.get('/:auctionId/bids', auctionController.getBidHistory);
router.get('/:auctionId/leaderboard', auctionController.getLeaderboard);

module.exports = router;