import { act, renderHook } from '@testing-library/react';
import { useDebugStore } from '../../stores/debugStore';
import { createDebugMetrics } from '../utils/debug-test-utils';
import { TestMetrics } from '../types/test.types';
import { DEBUG_CONFIG } from '../../config/debug.config';

describe('Debug Store', () => {
  beforeEach(() => {
    useDebugStore.setState({
      isEnabled: true,
      logs: [],
      metrics: createDebugMetrics()
    });
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useDebugStore());
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.logs).toHaveLength(0);
    expect(result.current.metrics).toEqual(createDebugMetrics());
  });

  it('should update metrics', () => {
    const { result } = renderHook(() => useDebugStore());

    const newMetrics: TestMetrics = {
      performance: {
        errorRate: 0.5,
        apiLatency: 1000,
        systemHealth: 0.5
      },
      wallet: {
        balances: { 'test-wallet': 100 },
        transactions: 5
      },
      trading: {
        activePositions: 3,
        totalVolume: 5000,
        profitLoss: 250
      }
    };

    act(() => {
      result.current.updateMetrics(newMetrics);
    });

    expect(result.current.metrics).toEqual(newMetrics);
  });

  it('should add logs with timestamp', () => {
    const { result } = renderHook(() => useDebugStore());
    const testLog = 'Test debug message';

    act(() => {
      result.current.addLog(testLog);
    });

    expect(result.current.logs).toHaveLength(1);
    expect(result.current.logs[0]).toMatch(/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] Test debug message/);
  });

  it('should maintain log size limit', () => {
    const { result } = renderHook(() => useDebugStore());
    const maxLogs = DEBUG_CONFIG.retention.max_logs;

    act(() => {
      for (let i = 0; i < maxLogs + 10; i++) {
        result.current.addLog(`Log ${i}`);
      }
    });

    expect(result.current.logs).toHaveLength(maxLogs);
    expect(result.current.logs[maxLogs - 1]).toMatch(/Log \d+/);
  });

  it('should toggle debug mode', () => {
    const { result } = renderHook(() => useDebugStore());

    act(() => {
      result.current.toggleDebug();
    });

    expect(result.current.isEnabled).toBe(false);

    act(() => {
      result.current.toggleDebug();
    });

    expect(result.current.isEnabled).toBe(true);
  });

  it('should clear logs', () => {
    const { result } = renderHook(() => useDebugStore());

    act(() => {
      result.current.addLog('Test log 1');
      result.current.addLog('Test log 2');
      result.current.clearLogs();
    });

    expect(result.current.logs).toHaveLength(0);
  });

  it('should persist metrics between sessions', () => {
    const { result } = renderHook(() => useDebugStore());
    const testMetrics = {
      performance: {
        errorRate: 0.1,
        apiLatency: 500,
        systemHealth: 0.9
      },
      wallet: {
        balances: { 'test-wallet': 50 },
        transactions: 2
      },
      trading: {
        activePositions: 1,
        totalVolume: 1000,
        profitLoss: 100
      }
    };

    act(() => {
      result.current.updateMetrics(testMetrics);
    });

    const storedMetrics = JSON.parse(localStorage.getItem('debug_metrics') || '{}');
    expect(storedMetrics).toEqual(testMetrics);

    act(() => {
      useDebugStore.setState({ metrics: createDebugMetrics() });
    });

    const { result: newResult } = renderHook(() => useDebugStore());
    expect(newResult.current.metrics).toEqual(testMetrics);
  });

  it('should handle invalid stored metrics', () => {
    localStorage.setItem('debug_metrics', 'invalid json');
    const { result } = renderHook(() => useDebugStore());
    expect(result.current.metrics).toEqual(createDebugMetrics());
  });
});
