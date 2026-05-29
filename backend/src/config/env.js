require('dotenv').config();

module.exports = {
    port: process.env.PORT || 8081,
    mysql: {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '123456',
        database: process.env.DB_NAME || 'live_auction'
    },
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379'
    }
};