const auctionService = require('../modules/auction/auction.service');
const logger = require('../utils/logger');

let intervalId = null;

function start() {
    intervalId = setInterval(async () => {
        await auctionService.checkAndSettleAuctions();
    }, 1000);
    logger.info('[Scheduler] 自动化全局清算守护心跳引擎挂载成功 (巡检步长: 1000ms)');
}

function stop() {
    if (intervalId) {
        clearInterval(intervalId);
        logger.info('[Scheduler] 清算守护进程注销中断');
    }
}

module.exports = { start, stop };