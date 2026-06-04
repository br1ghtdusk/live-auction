const db = require('../../infrastructure/db.js');
const mapper = require('./auction.mapper.js');

async function findById(id) {
    const [rows] = await db.getPool().execute(
        `SELECT id, merchant_id, room_id, name, image_url, description,
                start_price, current_price, final_price, bid_increment, ceiling_price,
                status, scheduled_start_time, scheduled_end_time,
                actual_start_time, actual_end_time,
                auto_extend_seconds, extend_trigger_seconds, extend_count, max_extend_count,
                highest_bidder_id, cancel_reason, version, created_at, updated_at
         FROM auctions WHERE id = ?`,
        [id]
    );
    return rows.length > 0 ? mapper.toDomainFromMysql(rows[0]) : null;
}

async function create(data) {
    const {
        merchant_id,
        room_id,
        name,
        image_url,
        description,
        start_price,
        current_price,
        bid_increment,
        ceiling_price,
        scheduled_start_time,
        scheduled_end_time,
        auto_extend_seconds = 10,
        extend_trigger_seconds = 10,
        max_extend_count = 99,
        created_at
    } = data;

    const [result] = await db.getPool().execute(
        `INSERT INTO auctions (merchant_id, room_id, name, image_url, description,
                start_price, current_price, bid_increment, ceiling_price, status,
                scheduled_start_time, scheduled_end_time,
                auto_extend_seconds, extend_trigger_seconds, max_extend_count,
                version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            merchant_id, room_id, name, image_url, description ?? '',
            start_price, current_price ?? start_price, bid_increment, ceiling_price,
            'WAITING',
            scheduled_start_time, scheduled_end_time,
            auto_extend_seconds, extend_trigger_seconds, max_extend_count,
            0, created_at, created_at
        ]
    );

    return result.insertId;
}

async function update(data) {
    const {
        id,
        name,
        image_url,
        description,
        start_price,
        bid_increment,
        ceiling_price,
        scheduled_start_time,
        scheduled_end_time,
        auto_extend_seconds,
        extend_trigger_seconds,
        max_extend_count,
        cancel_reason,
        updated_at
    } = data;

    const setClauses = [];
    const params = [];

    if (name !== undefined) { setClauses.push('name = ?'); params.push(name); }
    if (image_url !== undefined) { setClauses.push('image_url = ?'); params.push(image_url); }
    if (description !== undefined) { setClauses.push('description = ?'); params.push(description); }
    if (start_price !== undefined) { setClauses.push('start_price = ?'); params.push(start_price); }
    if (bid_increment !== undefined) { setClauses.push('bid_increment = ?'); params.push(bid_increment); }
    if (ceiling_price !== undefined) { setClauses.push('ceiling_price = ?'); params.push(ceiling_price); }
    if (scheduled_start_time !== undefined) { setClauses.push('scheduled_start_time = ?'); params.push(scheduled_start_time); }
    if (scheduled_end_time !== undefined) { setClauses.push('scheduled_end_time = ?'); params.push(scheduled_end_time); }
    if (auto_extend_seconds !== undefined) { setClauses.push('auto_extend_seconds = ?'); params.push(auto_extend_seconds); }
    if (extend_trigger_seconds !== undefined) { setClauses.push('extend_trigger_seconds = ?'); params.push(extend_trigger_seconds); }
    if (max_extend_count !== undefined) { setClauses.push('max_extend_count = ?'); params.push(max_extend_count); }
    if (cancel_reason !== undefined) { setClauses.push('cancel_reason = ?'); params.push(cancel_reason); }

    if (setClauses.length === 0) return 0;

    setClauses.push('version = version + 1');
    setClauses.push('updated_at = ?');
    params.push(updated_at);
    params.push(id);

    const [result] = await db.getPool().execute(
        `UPDATE auctions SET ${setClauses.join(', ')} WHERE id = ?`,
        params
    );

    return result.affectedRows;
}

async function updateStatusAndPrice(id, status, currentPrice, highestBidderId, updatedAt) {
    const [result] = await db.getPool().execute(
        `UPDATE auctions
         SET status = ?, current_price = ?, highest_bidder_id = ?,
             version = version + 1, updated_at = ?
         WHERE id = ?`,
        [status, currentPrice, highestBidderId, updatedAt, id]
    );
    return result.affectedRows;
}

async function updateStatusAndPriceWithLock(id, status, currentPrice, highestBidderId, version, updatedAt) {
    const [result] = await db.getPool().execute(
        `UPDATE auctions
         SET status = ?, current_price = ?, highest_bidder_id = ?,
             version = version + 1, updated_at = ?
         WHERE id = ? AND version < ?`,
        [status, currentPrice, highestBidderId, updatedAt, id, version + 1]
    );
    return result.affectedRows;
}

async function updateEndTime(id, newEndTime, updatedAt) {
    const [result] = await db.getPool().execute(
        `UPDATE auctions
         SET scheduled_end_time = ?, extend_count = extend_count + 1,
             version = version + 1, updated_at = ?
         WHERE id = ?`,
        [newEndTime, updatedAt, id]
    );
    return result.affectedRows;
}

async function updateSettledWithLock(id, status, finalPrice, highestBidderId, actualEndTime, version, updatedAt) {
    const [result] = await db.getPool().execute(
        `UPDATE auctions
         SET status = ?, final_price = ?, current_price = ?,
             highest_bidder_id = ?, actual_end_time = ?,
             version = version + 1, updated_at = ?
         WHERE id = ? AND version < ?`,
        [status, finalPrice, finalPrice, highestBidderId, actualEndTime, updatedAt, id, version + 1]
    );
    return result.affectedRows;
}

async function settle(id, status, finalPrice, highestBidderId, actualEndTime, updatedAt) {
    const [result] = await db.getPool().execute(
        `UPDATE auctions
         SET status = ?, current_price = ?, final_price = ?,
             highest_bidder_id = ?, actual_end_time = ?,
             version = version + 1, updated_at = ?
         WHERE id = ?`,
        [status, finalPrice, finalPrice, highestBidderId, actualEndTime, updatedAt, id]
    );
    return result.affectedRows;
}

async function start(id, status, actualStartTime, updatedAt) {
    const [result] = await db.getPool().execute(
        `UPDATE auctions
         SET status = ?, actual_start_time = ?,
             version = version + 1, updated_at = ?
         WHERE id = ?`,
        [status, actualStartTime, updatedAt, id]
    );
    return result.affectedRows;
}

async function activateWithLock(id, status, actualStartTime, scheduledEndTime, version, updatedAt) {
    const [result] = await db.getPool().execute(
        `UPDATE auctions
         SET status = ?, actual_start_time = ?, scheduled_end_time = ?,
             version = version + 1, updated_at = ?
         WHERE id = ? AND version < ?`,
        [status, actualStartTime, scheduledEndTime, updatedAt, id, version + 1]
    );
    return result.affectedRows;
}

async function cancel(id, status, cancelReason, actualEndTime, updatedAt) {
    const [result] = await db.getPool().execute(
        `UPDATE auctions
         SET status = ?, cancel_reason = ?, actual_end_time = ?,
             version = version + 1, updated_at = ?
         WHERE id = ?`,
        [status, cancelReason, actualEndTime, updatedAt, id]
    );
    return result.affectedRows;
}

async function findByMerchantId(merchantId, limit = 20, offset = 0) {
    const [rows] = await db.getPool().query(
        `SELECT id, merchant_id, room_id, name, image_url, status,
                start_price, bid_increment, ceiling_price,
                scheduled_start_time, scheduled_end_time, current_price, highest_bidder_id,
                description, extend_trigger_seconds, auto_extend_seconds, max_extend_count
         FROM auctions
         WHERE merchant_id = ?
         ORDER BY scheduled_start_time DESC
         LIMIT ? OFFSET ?`,
        [merchantId, limit, offset]
    );
    return rows;
}

async function findByRoomId(roomId, limit = 10, offset = 0) {
    if (roomId === undefined) throw new Error('roomId cannot be undefined');

    const [rows] = await db.getPool().query(
        `SELECT id, merchant_id, room_id, name, image_url, status,
                scheduled_start_time, scheduled_end_time, current_price, highest_bidder_id,
                actual_end_time, updated_at
         FROM auctions
         WHERE room_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [Number(roomId), Number(limit), Number(offset)]
    );
    return rows;
}

async function insertBidRecord(auctionId, userId, bidAmount, createdAt) {
    const [result] = await db.getPool().execute(
        `INSERT INTO bid_records (auction_id, user_id, bid_amount, created_at)
         VALUES (?, ?, ?, ?)`,
        [auctionId, userId, bidAmount, createdAt]
    );
    return result.insertId;
}

async function findBidHistoryByAuctionId(auctionId, limit = 50) {
    const [rows] = await db.getPool().query(
        `SELECT id, auction_id, user_id, bid_amount, created_at
         FROM bid_records
         WHERE auction_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [auctionId, limit]
    );
    return rows;
}

async function createOrder(data) {
    const {
        auction_id,
        merchant_id,
        winner_id,
        final_price,
        status = 'PENDING',
        created_at
    } = data;

    const [result] = await db.getPool().execute(
        `INSERT INTO orders (auction_id, merchant_id, winner_id, final_price, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [auction_id, merchant_id, winner_id, final_price, status, created_at, created_at]
    );
    return result.insertId;
}

async function findActiveAuctions() {
    const [rows] = await db.getPool().query(
        `SELECT id, room_id, merchant_id, status, scheduled_end_time
         FROM auctions
         WHERE status IN ('WAITING', 'BIDDING')
         ORDER BY scheduled_end_time ASC`
    );
    return rows;
}

async function updateById(id, fields) {
    const keys = Object.keys(fields);
    const values = Object.values(fields);
    
    if (keys.length === 0) {
        return;
    }
    
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const [result] = await db.getPool().execute(
        `UPDATE auctions SET ${setClause} WHERE id = ?`,
        [...values, Number(id)]
    );
    return result;
}

module.exports = {
    findById,
    create,
    update,
    updateStatusAndPrice,
    updateStatusAndPriceWithLock,
    updateEndTime,
    updateSettledWithLock,
    settle,
    start,
    activateWithLock,
    cancel,
    findByMerchantId,
    findByRoomId,
    findActiveAuctions,
    insertBidRecord,
    findBidHistoryByAuctionId,
    createOrder,
    updateById
};