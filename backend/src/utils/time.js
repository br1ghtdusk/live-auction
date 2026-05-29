/**
 * 统一转换任意时间格式为毫秒时间戳
 */
function parseTimeToMs(timeValue) {
    if (!timeValue) return 0;
    if (typeof timeValue === 'number') return timeValue;
    const date = new Date(timeValue);
    return date.getTime();
}

/**
 * 格式化时间戳为本地可读字符串
 */
function formatTimeToLocalString(timestamp) {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleString('zh-CN');
}

/**
 * 格式化时间戳为 MySQL DATETIME 格式 (YYYY-MM-DD HH:mm:ss)
 */
function formatTimeForMySQL(timestamp) {
    if (!timestamp) return null;
    const d = new Date(timestamp);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    const second = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

module.exports = { parseTimeToMs, formatTimeToLocalString, formatTimeForMySQL };