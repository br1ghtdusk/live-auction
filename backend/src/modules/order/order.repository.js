const db = require('../../infrastructure/db');

async function create(auctionId, merchantId, winnerId, finalPrice) {
    const [result] = await db.getPool().execute(
        'INSERT INTO orders (auction_id, merchant_id, winner_id, final_price, status) VALUES (?, ?, ?, ?, ?)',
        [auctionId, merchantId, winnerId, finalPrice, 'PENDING']
    );
    return result.insertId;
}

async function getByAuctionId(auctionId) {
    const [rows] = await db.getPool().execute(
        'SELECT id, auction_id, merchant_id, winner_id, final_price, status, paid_at, created_at, updated_at FROM orders WHERE auction_id = ?',
        [auctionId]
    );
    return rows.length > 0 ? rows[0] : null;
}

async function getById(orderId) {
    const [rows] = await db.getPool().execute(
        'SELECT id, auction_id, merchant_id, winner_id, final_price, status, paid_at, created_at, updated_at FROM orders WHERE id = ?',
        [orderId]
    );
    return rows.length > 0 ? rows[0] : null;
}

async function updateOrderStatus(orderId, status) {
    const [result] = await db.getPool().execute(
        'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?',
        [status, orderId]
    );
    return result.affectedRows;
}

async function updateOrderStatusByAuctionId(auctionId, status) {
    const [result] = await db.getPool().execute(
        'UPDATE orders SET status = ?, updated_at = NOW() WHERE auction_id = ?',
        [status, auctionId]
    );
    return result.affectedRows;
}

async function pay(orderId) {
    const [result] = await db.getPool().execute(
        'UPDATE orders SET status = ?, paid_at = NOW(), updated_at = NOW() WHERE id = ? AND status = ?',
        ['PAID', orderId, 'PENDING']
    );
    return result.affectedRows;
}

async function cancel(orderId) {
    const [result] = await db.getPool().execute(
        'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ? AND status = ?',
        ['CANCELLED', orderId, 'PENDING']
    );
    return result.affectedRows;
}

async function refund(orderId) {
    const [result] = await db.getPool().execute(
        'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ? AND status = ?',
        ['REFUNDED', orderId, 'PAID']
    );
    return result.affectedRows;
}

async function findByWinnerId(winnerId, limit = 20, offset = 0) {
    const [rows] = await db.getPool().execute(
        'SELECT id, auction_id, merchant_id, winner_id, final_price, status, paid_at, created_at FROM orders WHERE winner_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [winnerId, limit, offset]
    );
    return rows;
}

async function findOrdersByMerchantId(merchantId) {
    const [rows] = await db.getPool().query(
        `SELECT 
            o.id AS order_id,
            o.auction_id,
            o.merchant_id,
            o.winner_id,
            o.final_price,
            o.status,
            o.paid_at,
            o.created_at,
            o.updated_at,
            a.name AS auction_name,
            a.image_url AS auction_image
        FROM orders o
        LEFT JOIN auctions a ON o.auction_id = a.id
        WHERE o.merchant_id = ?
        ORDER BY o.created_at DESC`,
        [merchantId]
    );
    return rows;
}

module.exports = {
    create,
    getByAuctionId,
    getById,
    updateOrderStatus,
    updateOrderStatusByAuctionId,
    pay,
    cancel,
    refund,
    findByWinnerId,
    findOrdersByMerchantId
};