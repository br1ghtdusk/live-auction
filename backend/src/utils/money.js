/**
 * 分转元格式化
 */
function fenToYuan(fen) {
    return (fen / 100).toFixed(2);
}

module.exports = { fenToYuan };