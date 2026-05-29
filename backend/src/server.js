const http = require('http');
const app = require('./app');
const config = require('./config/env');
const db = require('./infrastructure/db');
const redis = require('./infrastructure/redis');
const wss = require('./infrastructure/wss');
const websocketConfig = require('./config/websocket');
const auctionService = require('./modules/auction/auction.service');
const auctionWsHandler = require('./modules/auction/auction.ws');
const auctionEventHandler = require('./modules/auction/auction-event-handler');
const scheduler = require('./scheduler/auction-scheduler');
const logger = require('./utils/logger');

const server = http.createServer(app);

async function start() {
    try {
        logger.info('[Server Master] 核心集群系统引导装载程序激活...');

        db.init();
        await redis.connect();

        auctionWsHandler.setAuctionService(auctionService);
        auctionWsHandler.init();

        auctionEventHandler.setWss(wss);
        auctionEventHandler.init();

        await auctionService.initializeAuctionCache(1);

        websocketConfig.initWebSocket(server);

        scheduler.start();

        server.listen(config.port, () => {
            logger.info(`[Server Master] 🚀 直播竞拍大师后端中枢正常起航: http://localhost:${config.port}`);
            logger.info(`[Server Master] 🎯 实时 WS 数据交换链路网关处于完全就绪状态`);
        });
    } catch (error) {
        logger.error('[Server Fatal] 服务网关引擎启动崩溃:', error);
        process.exit(1);
    }
}

start();