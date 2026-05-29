const mysql = require('mysql2/promise');
const mysqlConfig = require('../config/mysql');
const logger = require('../utils/logger');

let pool = null;

function init() {
    pool = mysql.createPool(mysqlConfig);
    logger.info('[MySQL] 物理数据库连接池初始化成功');
}

function getPool() {
    if (!pool) init();
    return pool;
}

module.exports = { init, getPool };