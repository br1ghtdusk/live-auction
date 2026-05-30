export const fenToYuan = (fen: number | string): number => {
  return (typeof fen === 'string' ? parseInt(fen, 10) : fen) / 100;
};

/**
 * 格式化价格为人民币格式
 * @param price - 价格（分）
 */
export const formatPrice = (price: number | string): string => {
  const yuan = fenToYuan(price);
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(yuan);
};

const NO_CEILING_SENTINEL = 9999999999;

export const formatCeilingPrice = (ceilingPrice: number): string => {
  if (ceilingPrice >= NO_CEILING_SENTINEL) {
    return '上不封顶';
  }
  return formatPrice(ceilingPrice);
};  