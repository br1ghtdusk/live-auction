const WebSocket = require('ws');
const eventBus = require('../modules/auction/event-bus.js');
const logger = require('../utils/logger');

const rooms = new Map();
let wss = null;

function setWssInstance(instance) {
    wss = instance;
}

function getRooms() {
    return rooms;
}

function broadcast(roomId, message) {
    const clients = rooms.get(roomId);
    if (!clients) return;
    const payload = JSON.stringify(message);
    logger.info(`[WS Broadcast] Room ${roomId}: Type=${message.type}, PayloadSize=${payload.length}`);
    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });
}

function handleConnection(ws, req) {
    logger.info('[WS] 捕捉到新客户端物理连接建立');

    const urlParams = new URL(req.url, 'http://localhost').searchParams;
    const roomIdStr = urlParams.get('roomId') || '101';
    const roomId = parseInt(roomIdStr, 10);

    if (isNaN(roomId) || roomId <= 0) {
        logger.warn(`[WS] 无效的 roomId 参数: "${roomIdStr}"，拒绝连接`);
        ws.close(1008, 'Invalid roomId');
        return;
    }

    logger.info(`[WS] Successfully connected to room: ${roomId}`);

    if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(ws);

    eventBus.emit('ws:connection', { ws, roomId });

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            eventBus.emit('ws:message', { ws, roomId, data });
        } catch (error) {
            logger.error('[WS] 数据报解析异常:', error);
        }
    });

    ws.on('close', () => {
        logger.info('[WS] 客户端物理断开');
        const clients = rooms.get(roomId);
        if (clients) {
            clients.delete(ws);
            if (clients.size === 0) rooms.delete(roomId);
        }
        eventBus.emit('ws:close', { ws, roomId });
    });

    ws.on('error', (err) => logger.error('[WS] 通道异常:', err));
}

function init(server) {
    wss = new WebSocket.Server({ server });
    logger.info('[WS] WebSocket 网关服务器基座构建成功（备用初始化路径）');

    wss.on('connection', (ws, req) => {
        handleConnection(ws, req);
    });
}

function getWssInstance() {
    return wss;
}

module.exports = {
    init,
    setWssInstance,
    getWssInstance,
    handleConnection,
    broadcast,
    getRooms
};