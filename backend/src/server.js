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

function setupGracefulShutdown(server) {
    const shutdown = async (signal) => {
        logger.info(`[Server Master] 收到 ${signal} 信号，开始停机...`);

        const timeout = setTimeout(() => {
            logger.error('[Server Fatal] 停机超时，强制退出');
            process.exit(1);
        }, 10000);

        try {
            logger.info('[Server Master] 步骤1: 停止调度器...');
            scheduler.stop();

            logger.info('[Server Master] 步骤2: 主动断开所有 WebSocket 连接...');
            let clientCount = 0;
            const wssInstance = wss.getWssInstance();
            if (wssInstance?.clients) {
                wssInstance.clients.forEach((client) => {
                    if (client.readyState === client.OPEN) {
                        clientCount++;
                        try {
                            client.send(JSON.stringify({
                                type: 'system',
                                message: '系统维护中，连接即将断开，请稍后重试'
                            }));
                            client.close(1001, '系统维护');
                        } catch (wsError) {
                            logger.warn(`[Server Master] 断开客户端连接时发生错误: ${wsError.message}`);
                        }
                    }
                });
            }
            logger.info(`[Server Master] 已通知并断开 ${clientCount} 个 WebSocket 客户端`);

            logger.info('[Server Master] 步骤3: 关闭 WebSocket 服务器实例...');
            if (wssInstance) {
                await new Promise((resolve) => {
                    wssInstance.close((err) => {
                        if (err) {
                            logger.warn('[Server Master] 关闭 WebSocket 服务器时发生错误:', err);
                        } else {
                            logger.info('[Server Master] WebSocket 服务器已关闭');
                        }
                        resolve();
                    });
                });
            }

            logger.info('[Server Master] 步骤4: 关闭 HTTP 服务器...');
            await new Promise((resolve, reject) => {
                server.close((err) => {
                    if (err) {
                        logger.error('[Server Master] 关闭 HTTP 服务器时发生错误:', err);
                        return reject(err);
                    }
                    logger.info('[Server Master] HTTP 服务器已关闭');
                    resolve();
                });
            });

            logger.info('[Server Master] 步骤5: 断开 Redis 连接...');
            await redis.disconnect().catch((err) => {
                logger.warn('[Server Master] 断开 Redis 连接时发生错误:', err);
            });

            logger.info('[Server Master] 步骤6: 释放数据库连接池...');
            await db.getPool().end().catch((err) => {
                logger.warn('[Server Master] 释放数据库连接池时发生错误:', err);
            });

            clearTimeout(timeout);
            logger.info('[Server Master] ✅停机完成，资源清理完成');
        } catch (error) {
            logger.error('[Server Fatal] 停机过程发生错误:', error);
            clearTimeout(timeout);
            throw error;
        }
    };

    process.once('SIGUSR2', async () => {
        logger.info('[Server Master] 收到 Nodemon 重启信号 (SIGUSR2)...');
        try {
            await shutdown('SIGUSR2');
            logger.info('[Server Master] 资源清理完成，通知 Nodemon 继续重启...');
            process.kill(process.pid, 'SIGUSR2');
        } catch (error) {
            logger.error('[Server Fatal] Nodemon 重启时发生错误:', error);
            process.exit(1);
        }
    });

    process.on('SIGTERM', async () => {
        try {
            await shutdown('SIGTERM');
            process.exit(0);
        } catch (error) {
            logger.error('[Server Fatal] SIGTERM 停机时发生错误:', error);
            process.exit(1);
        }
    });

    process.on('SIGINT', async () => {
        try {
            await shutdown('SIGINT');
            process.exit(0);
        } catch (error) {
            logger.error('[Server Fatal] SIGINT 停机时发生错误:', error);
            process.exit(1);
        }
    });
}

async function start() {
    try {
        logger.info('[Server Master] 核心集群系统引导装载程序激活...');

        db.init();
        await redis.connect();

        logger.info('[Server Master] 步骤1: 初始化 WebSocket 底层网关...');
        websocketConfig.initWebSocket(server);

        logger.info('[Server Master] 步骤2: 绑定业务处理器...');
        auctionWsHandler.setAuctionService(auctionService);
        auctionWsHandler.init();

        auctionEventHandler.setWss(wss);
        auctionEventHandler.init();

        logger.info('[Server Master] 步骤3: 动态预热活跃拍品缓存...');
        await auctionService.warmUpActiveAuctionsCache();

        logger.info('[Server Master] 步骤4: 启动调度器...');
        scheduler.start();

        logger.info('[Server Master] 步骤5: 注册停机处理器...');
        setupGracefulShutdown(server);

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