const express = require('express');
const router = express.Router();
const auctionController = require('./auction.controller');

router.get('/', auctionController.getAuctions);
router.get('/:id', auctionController.getAuctionById);
router.post('/', auctionController.createAuction);

module.exports = router;