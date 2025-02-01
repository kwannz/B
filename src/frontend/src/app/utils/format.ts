/**
 * 截断地址字符串,保留开头和结尾的字符
 * @param address 完整地址字符串
 * @param startLength 保留开头的字符数,默认为6
 * @param endLength 保留结尾的字符数,默认为4
 * @returns 截断后的地址字符串
 */
export function truncateAddress(
  address: string,
  startLength: number = 6,
  endLength: number = 4
): string {
  if (!address) return '';
  if (address.length <= startLength + endLength) return address;
  
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
}

/**
 * 格式化数字为带千位分隔符的字符串
 * @param num 要格式化的数字
 * @param decimals 保留的小数位数,默认为2
 * @returns 格式化后的字符串
 */
export function formatNumber(num: number, decimals: number = 2): string {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * 格式化时间戳为本地日期时间字符串
 * @param timestamp 时间戳(毫秒)或ISO日期字符串
 * @returns 格式化后的日期时间字符串
 */
export function formatDateTime(timestamp: number | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * 格式化持续时间(毫秒)为可读字符串
 * @param duration 持续时间(毫秒)
 * @returns 格式化后的持续时间字符串
 */
export function formatDuration(duration: number): string {
  const hours = Math.floor(duration / 3600000);
  const minutes = Math.floor((duration % 3600000) / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);

  const parts = [];
  if (hours > 0) parts.push(`${hours}小时`);
  if (minutes > 0) parts.push(`${minutes}分钟`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}秒`);

  return parts.join(' ');
}

/**
 * 格式化价格为带货币符号的字符串
 * @param price 价格数值
 * @param currency 货币代码,默认为USDT
 * @returns 格式化后的价格字符串
 */
export function formatPrice(price: number, currency: string = 'USDT'): string {
  return `${formatNumber(price)} ${currency}`;
}
