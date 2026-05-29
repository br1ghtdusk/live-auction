const express = require('express');
const cors = require('cors');
const auctionRoutes = require('./modules/auction/auction.routes');

const app = express();

app.use(cors());
app.use(express.json());

// 挂载垂直隔离的切片式 HTTP 接口集
app.use('/api/auction', auctionRoutes);

module.exports = app;