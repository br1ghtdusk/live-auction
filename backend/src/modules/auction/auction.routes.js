const express = require('express');
const router = express.Router();
const auctionController = require('./auction.controller');

router.get('/:id', auctionController.getAuctionById);

module.exports = router;