const db = require('../../infrastructure/db');

/**
 * 创建订单
 */
async function create(auctionId, merchantId, winnerId, finalPrice) {
    const [result] = await db.getPool().execute(
        'INSERT INTO orders (auction_id, merchant_id, winner_id, final_price, status) VALUES (?, ?, ?, ?, ?)',
        [auctionId, merchantId, winnerId, finalPrice, 'PENDING']
    );
    return result.insertId;
}

/**
 * 根据竞拍ID获取订单
 */
async function getByAuctionId(auctionId) {
    const [rows] = await db.getPool().execute(
        'SELECT id, auction_id, merchant_id, winner_id, final_price, status, paid_at, created_at, updated_at FROM orders WHERE auction_id = ?',
        [auctionId]
    );
    return rows.length > 0 ? rows[0] : null;
}

/**
 * 根据订单ID获取订单
 */
async function getById(orderId) {
    const [rows] = await db.getPool().execute(
        'SELECT id, auction_id, merchant_id, winner_id, final_price, status, paid_at, created_at, updated_at FROM orders WHERE id = ?',
        [orderId]
    );
    return rows.length > 0 ? rows[0] : null;
}

/**
 * 更新订单状态
 */
async function updateStatus(orderId, status) {
    const [result] = await db.getPool().execute(
        'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?',
        [status, orderId]
    );
    return result.affectedRows;
}

/**
 * 支付订单
 */
async function pay(orderId) {
    const [result] = await db.getPool().execute(
        'UPDATE orders SET status = ?, paid_at = NOW(), updated_at = NOW() WHERE id = ? AND status = ?',
        ['PAID', orderId, 'PENDING']
    );
    return result.affectedRows;
}

/**
 * 取消订单
 */
async function cancel(orderId) {
    const [result] = await db.getPool().execute(
        'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ? AND status = ?',
        ['CANCELLED', orderId, 'PENDING']
    );
    return result.affectedRows;
}

/**
 * 退款订单
 */
async function refund(orderId) {
    const [result] = await db.getPool().execute(
        'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ? AND status = ?',
        ['REFUNDED', orderId, 'PAID']
    );
    return result.affectedRows;
}

/**
 * 根据用户ID查询订单列表
 */
async function findByWinnerId(winnerId, limit = 20, offset = 0) {
    const [rows] = await db.getPool().execute(
        'SELECT id, auction_id, merchant_id, winner_id, final_price, status, paid_at, created_at FROM orders WHERE winner_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [winnerId, limit, offset]
    );
    return rows;
}

/**
 * 根据商家ID查询订单列表
 */
async function findByMerchantId(merchantId, limit = 20, offset = 0) {
    const [rows] = await db.getPool().execute(
        'SELECT id, auction_id, merchant_id, winner_id, final_price, status, paid_at, created_at FROM orders WHERE merchant_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [merchantId, limit, offset]
    );
    return rows;
}

module.exports = {
    create,
    getByAuctionId,
    getById,
    updateStatus,
    pay,
    cancel,
    refund,
    findByWinnerId,
    findByMerchantId
};