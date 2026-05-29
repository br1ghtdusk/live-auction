const env = require('./env');

module.exports = {
    host: env.mysql.host,
    user: env.mysql.user,
    password: env.mysql.password,
    database: env.mysql.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};