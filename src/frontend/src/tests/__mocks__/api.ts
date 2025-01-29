export const createBot = vi.fn().mockResolvedValue({ id: 'test-bot-id' });
export const generateWallet = vi.fn().mockResolvedValue({
  address: 'test-wallet-address',
  privateKey: 'test-private-key'
});
export const getTradingHistory = vi.fn().mockResolvedValue([{
  id: '1',
  type: 'BUY',
  amount: 1.5,
  price: 50000,
  timestamp: new Date().toISOString(),
  status: 'COMPLETED'
}]);
