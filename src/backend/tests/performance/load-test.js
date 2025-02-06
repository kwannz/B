import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // 逐步增加到 50 个用户
    { duration: '3m', target: 50 },   // 保持 50 个用户 3 分钟
    { duration: '1m', target: 100 },  // 逐步增加到 100 个用户
    { duration: '3m', target: 100 },  // 保持 100 个用户 3 分钟
    { duration: '1m', target: 0 },    // 逐步减少到 0 用户
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% 的请求应在 500ms 内完成
    errors: ['rate<0.1'],              // 错误率应小于 10%
  },
};

export default function () {
  const BASE_URL = __ENV.BASE_URL || 'http://localhost:8123';
  
  // 健康检查
  const healthCheck = http.get(`${BASE_URL}/health`);
  check(healthCheck, {
    'health check status is 200': (r) => r.status === 200,
  });

  // 市场数据 API
  const marketData = http.get(`${BASE_URL}/api/v1/market/data`);
  check(marketData, {
    'market data status is 200': (r) => r.status === 200,
    'market data has correct format': (r) => r.json().hasOwnProperty('data'),
  });

  // 模拟交易 API
  const payload = JSON.stringify({
    symbol: 'BTC-USD',
    side: 'buy',
    quantity: 0.1,
    price: 50000,
  });

  const trade = http.post(`${BASE_URL}/api/v1/trade/simulate`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(trade, {
    'trade status is 200': (r) => r.status === 200,
    'trade response has order id': (r) => r.json().hasOwnProperty('order_id'),
  });

  sleep(1);
}  