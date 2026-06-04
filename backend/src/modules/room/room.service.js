const db = require('../../infrastructure/db');

class RoomService {
  async findActiveRooms(merchantId = null) {
    let sql = 'SELECT id, merchant_id, room_name FROM rooms WHERE status = ?';
    const params = ['ACTIVE'];

    if (merchantId) {
      sql += ' AND merchant_id = ?';
      params.push(merchantId);
    }

    sql += ' ORDER BY id ASC';

    const [rows] = await db.getPool().execute(sql, params);
    return rows;
  }

  async findById(roomId) {
    const [rows] = await db.getPool().execute(
      'SELECT id, merchant_id, room_name, status, created_at FROM rooms WHERE id = ?',
      [roomId]
    );
    return rows[0] || null;
  }
}

module.exports = new RoomService();