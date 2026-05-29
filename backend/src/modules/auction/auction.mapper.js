function toDomainFromMysql(row) {
    if (!row) return null;

    const scheduledStartTime = row.scheduled_start_time instanceof Date
        ? row.scheduled_start_time.getTime()
        : (row.scheduled_start_time ? new Date(row.scheduled_start_time).getTime() : 0);

    const scheduledEndTime = row.scheduled_end_time instanceof Date
        ? row.scheduled_end_time.getTime()
        : (row.scheduled_end_time ? new Date(row.scheduled_end_time).getTime() : 0);

    const actualStartTime = row.actual_start_time instanceof Date
        ? row.actual_start_time.getTime()
        : (row.actual_start_time ? new Date(row.actual_start_time).getTime() : null);

    const actualEndTime = row.actual_end_time instanceof Date
        ? row.actual_end_time.getTime()
        : (row.actual_end_time ? new Date(row.actual_end_time).getTime() : null);

    return {
        id: Number(row.id),
        merchant_id: Number(row.merchant_id),
        room_id: Number(row.room_id),
        name: row.name || '',
        image_url: row.image_url || null,
        description: row.description || '',
        start_price: Number(row.start_price),
        current_price: Number(row.current_price),
        final_price: row.final_price !== null ? Number(row.final_price) : null,
        bid_increment: Number(row.bid_increment),
        ceiling_price: Number(row.ceiling_price),
        status: row.status,
        scheduled_start_time: scheduledStartTime,
        scheduled_end_time: scheduledEndTime,
        actual_start_time: actualStartTime,
        actual_end_time: actualEndTime,
        auto_extend_seconds: Number(row.auto_extend_seconds),
        extend_trigger_seconds: Number(row.extend_trigger_seconds),
        extend_count: Number(row.extend_count),
        max_extend_count: Number(row.max_extend_count),
        highest_bidder_id: row.highest_bidder_id !== null ? Number(row.highest_bidder_id) : null,
        cancel_reason: row.cancel_reason || null,
        version: Number(row.version),
        created_at: row.created_at instanceof Date ? row.created_at.getTime() : (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
        updated_at: row.updated_at instanceof Date ? row.updated_at.getTime() : (row.updated_at ? new Date(row.updated_at).getTime() : Date.now())
    };
}

function toDomainFromRedis(hash) {
    if (!hash || Object.keys(hash).length === 0) return null;

    const scheduledStartTime = Number(hash.scheduled_start_time);
    const scheduledEndTime = Number(hash.scheduled_end_time);
    
    if (!scheduledStartTime || !scheduledEndTime) {
        console.log('[Mapper WARNING] Redis 数据中时间戳为空或无效!');
        console.log('[Mapper WARNING] scheduled_start_time:', hash.scheduled_start_time, '->', scheduledStartTime);
        console.log('[Mapper WARNING] scheduled_end_time:', hash.scheduled_end_time, '->', scheduledEndTime);
    }

    return {
        id: Number(hash.id),
        merchant_id: Number(hash.merchant_id) || 0,
        room_id: Number(hash.room_id) || 0,
        name: hash.name || '',
        image_url: hash.image_url || null,
        description: hash.description || '',
        start_price: Number(hash.start_price) || 0,
        current_price: Number(hash.current_price) || 0,
        final_price: hash.final_price ? Number(hash.final_price) : null,
        bid_increment: Number(hash.bid_increment) || 0,
        ceiling_price: Number(hash.ceiling_price) || 0,
        status: hash.status || '',
        scheduled_start_time: scheduledStartTime || Date.now() + 3600000,  // 默认1小时后
        scheduled_end_time: scheduledEndTime || Date.now() + 7200000,      // 默认2小时后
        actual_start_time: hash.actual_start_time ? Number(hash.actual_start_time) : null,
        actual_end_time: hash.actual_end_time ? Number(hash.actual_end_time) : null,
        auto_extend_seconds: Number(hash.auto_extend_seconds) || 10,
        extend_trigger_seconds: Number(hash.extend_trigger_seconds) || 10,
        extend_count: Number(hash.extend_count) || 0,
        max_extend_count: Number(hash.max_extend_count) || 99,
        highest_bidder_id: (hash.highest_bidder_id && hash.highest_bidder_id !== '0')
            ? Number(hash.highest_bidder_id)
            : null,
        cancel_reason: hash.cancel_reason || null,
        version: Number(hash.version) || 0,
        created_at: Number(hash.created_at) || Date.now(),
        updated_at: Number(hash.updated_at) || Date.now()
    };
}

function toRedisHash(domain) {
    return {
        id: String(domain.id),
        merchant_id: String(domain.merchant_id || 0),
        room_id: String(domain.room_id || 0),
        name: String(domain.name || ''),
        image_url: domain.image_url ? String(domain.image_url) : '',
        description: String(domain.description || ''),
        start_price: String(domain.start_price || 0),
        current_price: String(domain.current_price || 0),
        final_price: domain.final_price !== null ? String(domain.final_price) : '',
        bid_increment: String(domain.bid_increment || 0),
        ceiling_price: String(domain.ceiling_price || 0),
        status: String(domain.status || ''),
        scheduled_start_time: String(domain.scheduled_start_time || 0),
        scheduled_end_time: String(domain.scheduled_end_time || 0),
        actual_start_time: domain.actual_start_time !== null ? String(domain.actual_start_time) : '',
        actual_end_time: domain.actual_end_time !== null ? String(domain.actual_end_time) : '',
        auto_extend_seconds: String(domain.auto_extend_seconds || 10),
        extend_trigger_seconds: String(domain.extend_trigger_seconds || 10),
        extend_count: String(domain.extend_count || 0),
        max_extend_count: String(domain.max_extend_count || 99),
        highest_bidder_id: domain.highest_bidder_id !== null ? String(domain.highest_bidder_id) : '0',
        cancel_reason: domain.cancel_reason ? String(domain.cancel_reason) : '',
        version: String(domain.version || 0),
        created_at: String(domain.created_at || Date.now()),
        updated_at: String(domain.updated_at || Date.now())
    };
}

module.exports = {
    toDomainFromMysql,
    toDomainFromRedis,
    toRedisHash
};