const roomService = require('./room.service');

async function getRooms(req, res) {
  try {
    const merchantId = req.query.merchantId
      ? parseInt(req.query.merchantId, 10)
      : null;

    const rooms = await roomService.findActiveRooms(merchantId);

    res.json({
      code: 0,
      message: 'success',
      data: rooms,
    });
  } catch (error) {
    console.error('[Controller Error] getRooms:', error);
    res.status(500).json({
      code: 500,
      message: 'Internal system error',
      data: null,
    });
  }
}

async function getRoom(req, res) {
  try {
    const { roomId } = req.params;
    const room = await roomService.findById(parseInt(roomId, 10));

    if (!room) {
      return res.status(404).json({
        code: 404,
        message: '直播间不存在',
        data: null,
      });
    }

    res.json({
      code: 0,
      message: 'success',
      data: room,
    });
  } catch (error) {
    console.error('[Controller Error] getRoom:', error);
    res.status(500).json({
      code: 500,
      message: 'Internal system error',
      data: null,
    });
  }
}

module.exports = {
  getRooms,
  getRoom,
};