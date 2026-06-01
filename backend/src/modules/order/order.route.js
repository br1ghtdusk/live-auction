const express = require('express');
const orderController = require('./order.controller');

const router = express.Router();

router.get('/orders', orderController.getMerchantOrders);

module.exports = router;