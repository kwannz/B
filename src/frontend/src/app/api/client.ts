/**
 * 交易API客户端
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * SOL转账
 * @param fromAddress 发送方地址
 * @param toAddress 接收方地址
 * @param amount 转账金额
 * @returns 交易哈希
 */
export async function transferSOL(
  fromAddress: string,
  toAddress: string,
  amount: number
): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/transfer/sol`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fromAddress,
      toAddress,
      amount,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '转账失败');
  }

  const { txHash } = await response.json();
  return txHash;
}

/**
 * USDT转账
 * @param fromAddress 发送方地址
 * @param toAddress 接收方地址
 * @param amount 转账金额
 * @returns 交易哈希
 */
export async function transferUSDT(
  fromAddress: string,
  toAddress: string,
  amount: number
): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/transfer/usdt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fromAddress,
      toAddress,
      amount,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '转账失败');
  }

  const { txHash } = await response.json();
  return txHash;
}

/**
 * 获取钱包余额
 * @param address 钱包地址
 * @returns 余额信息
 */
export async function getWalletBalance(address: string): Promise<{
  sol: number;
  usdt: number;
}> {
  const response = await fetch(`${API_BASE_URL}/api/wallet/balance/${address}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '获取余额失败');
  }

  return response.json();
}

/**
 * 获取交易历史
 * @param address 钱包地址
 * @returns 交易历史列表
 */
export async function getTransactionHistory(address: string): Promise<Array<{
  txHash: string;
  type: 'send' | 'receive';
  token: 'SOL' | 'USDT';
  amount: number;
  timestamp: string;
  status: 'confirmed' | 'pending' | 'failed';
  fromAddress: string;
  toAddress: string;
  fee: number;
}>> {
  const response = await fetch(`${API_BASE_URL}/api/transactions/${address}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '获取交易历史失败');
  }

  return response.json();
}

/**
 * 获取交易费用估算
 * @returns 费用信息
 */
export async function getTransferFees(): Promise<{
  sol: number;
  usdt: number;
}> {
  const response = await fetch(`${API_BASE_URL}/api/transfer/fees`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '获取费用信息失败');
  }

  return response.json();
}
