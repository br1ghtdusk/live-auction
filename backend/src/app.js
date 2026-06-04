const express = require('express');
const cors = require('cors');
const auctionRoutes = require('./modules/auction/auction.routes');
const orderRoutes = require('./modules/order/order.routes');
const roomRoutes = require('./modules/room/room.routes');

const app = express();

app.use(cors());
app.use(express.json());

// 挂载垂直隔离的切片式 HTTP 接口集
app.use('/api/admin/auctions', auctionRoutes);
app.use('/api/merchant', orderRoutes);
app.use('/api/rooms', roomRoutes);

module.exports = app;