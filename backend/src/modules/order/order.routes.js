const express = require('express');
const orderController = require('./order.controller');

const router = express.Router();

router.get('/orders', orderController.getMerchantOrders);
router.post('/pay', orderController.payOrder);

module.exports = router;