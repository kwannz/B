export const config = {
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
    wsUrl: process.env.NEXT_PUBLIC_WEBSOCKET_URL,
  },
  solana: {
    network: process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet',
    rpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
  },
  trading: {
    minBalanceRequired: Number(process.env.NEXT_PUBLIC_MIN_BALANCE_REQUIRED) || 0.5,
    transactionFeeReserve: Number(process.env.NEXT_PUBLIC_TRANSACTION_FEE_RESERVE) || 0.1,
  },
  thirdweb: {
    clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID,
    secretKey: process.env.NEXT_PUBLIC_THIRDWEB_SECRET_KEY,
  },
  features: {
    enableDeveloperTools: process.env.NEXT_PUBLIC_ENABLE_DEVELOPER_TOOLS === 'true',
    enableMockData: process.env.NEXT_PUBLIC_ENABLE_MOCK_DATA === 'true',
  },
  monitoring: {
    metricsRefreshInterval: Number(process.env.NEXT_PUBLIC_METRICS_REFRESH_INTERVAL) || 30000,
    tradingRefreshInterval: Number(process.env.NEXT_PUBLIC_TRADING_REFRESH_INTERVAL) || 15000,
  },
} as const;
