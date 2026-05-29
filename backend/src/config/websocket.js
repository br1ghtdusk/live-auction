const WebSocket = require('ws');
const wssGateway = require('../infrastructure/wss.js');
const logger = require('../utils/logger.js');

function initWebSocket(server) {
    const wss = new WebSocket.Server({ 
        server,
        perMessageDeflate: {
            zlibDeflateOptions: { level: 9 },
            zlibInflateOptions: { chunkSize: 1024 },
            clientNoContextTakeover: true,
            serverNoContextTakeover: true,
            serverMaxWindowBits: 10,
            concurrencyLimit: 10,
            threshold: 1024
        }
    });

    wssGateway.setWssInstance(wss);

    wss.on('connection', (ws, req) => {
        wssGateway.handleConnection(ws, req);
    });

    wss.on('error', (error) => {
        logger.error('[WS Config] WebSocket 服务器异常:', error);
    });

    logger.info('[WS Config] WebSocket 配置层初始化完成');

    return wss;
}

module.exports = {
    initWebSocket
};