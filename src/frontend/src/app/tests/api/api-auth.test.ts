import { renderHook, act } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { runDebugApiTest } from '../utils/debug-test-runner';
import { mockAPI } from '../setup/test-config';
import { DEBUG_CONFIG } from '../../config/debug.config';
import { ApiClient } from '../../api/client';
import { debugMetricsMiddleware } from '../../middleware/debugMetricsMiddleware';

describe('API Authentication Integration', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
    apiClient = new ApiClient();
  });

  it('should track wallet authentication metrics', async () => {
    const walletOperations = [
      { type: 'connect', success: true },
      { type: 'sign', success: true },
      { type: 'verify', success: true }
    ];

    for (const op of walletOperations) {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: `/api/auth/${op.type}` },
          async () => {
            if (op.success) {
              return { status: 200, data: { success: true } };
            }
            throw new Error(`${op.type} failed`);
          }
        );
      });
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.auth.successRate).toBe(1);
    expect(metrics.performance.apiLatency).toBeLessThan(
      DEBUG_CONFIG.thresholds.system.latency
    );
  });

  it('should handle wallet connection failures', async () => {
    mockAPI.connectWallet.mockRejectedValue(
      new Error('Wallet connection failed')
    );

    try {
      await runDebugApiTest(async () => {
        await debugMetricsMiddleware(
          { method: 'POST', url: '/api/auth/connect' },
          () => apiClient.connectWallet()
        );
      });
    } catch (error) {
      expect(error).toBeDefined();
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.auth.successRate).toBeLessThan(1);
    expect(useDebugStore.getState().logs).toContain(
      expect.stringContaining('Wallet connection failed')
    );
  });

  it('should track signature verification metrics', async () => {
    const signatureTests = [
      { valid: true, delay: 100 },
      { valid: false, delay: 200 },
      { valid: true, delay: 300 }
    ];

    for (const test of signatureTests) {
      mockAPI.verifySignature.mockImplementation(() =>
        new Promise((resolve, reject) => {
          setTimeout(() => {
            if (test.valid) {
              resolve({ verified: true });
            } else {
              reject(new Error('Invalid signature'));
            }
          }, test.delay);
        })
      );

      try {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'POST', url: '/api/auth/verify' },
            () => apiClient.verifySignature('test-signature')
          );
        });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.auth.verificationRate).toBeCloseTo(0.67, 2);
    expect(metrics.performance.apiLatency).toBeGreaterThan(100);
  });

  it('should handle concurrent authentication requests', async () => {
    const concurrentRequests = Array(5).fill(null).map((_, i) => ({
      walletId: `wallet-${i}`,
      delay: 100 * (i + 1)
    }));

    await Promise.all(
      concurrentRequests.map(req =>
        runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'POST', url: '/api/auth/connect' },
            async () => {
              await new Promise(resolve => setTimeout(resolve, req.delay));
              return apiClient.connectWallet(req.walletId);
            }
          );
        })
      )
    );

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.concurrentRequests).toBeLessThanOrEqual(
      DEBUG_CONFIG.thresholds.api.concurrent_requests
    );
    expect(metrics.auth.successRate).toBe(1);
  });

  it('should track authentication timeout patterns', async () => {
    const timeoutTests = Array(3).fill(null).map((_, i) => ({
      delay: DEBUG_CONFIG.thresholds.api.timeout_ms * (i + 1)
    }));

    for (const test of timeoutTests) {
      mockAPI.connectWallet.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, test.delay))
      );

      try {
        await runDebugApiTest(async () => {
          await debugMetricsMiddleware(
            { method: 'POST', url: '/api/auth/connect' },
            () => apiClient.connectWallet('test-wallet')
          );
        });
      } catch (e) {
        expect(e).toBeDefined();
      }
    }

    const metrics = useDebugStore.getState().metrics;
    expect(metrics.performance.timeoutRate).toBeGreaterThan(0);
    expect(metrics.auth.successRate).toBeLessThan(1);
  });
});
