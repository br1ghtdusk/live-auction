const express = require('express');
const router = express.Router();
const roomController = require('./room.controller');

router.get('/', roomController.getRooms);
router.get('/:roomId', roomController.getRoom);
router.get('/:roomId/display-state', roomController.getRoomDisplayState);

module.exports = router;