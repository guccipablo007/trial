export function formatCurrency(value: number | string | null | undefined) {
  const num = typeof value === 'string' ? Number(value) : value;
  if (num === null || num === undefined || Number.isNaN(Number(num))) return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(0);
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 2,
  }).format(Number(num));
}

