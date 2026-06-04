const express = require('express');
const router = express.Router();
const roomController = require('./room.controller');

router.get('/', roomController.getRooms);
router.get('/:roomId', roomController.getRoom);

module.exports = router;