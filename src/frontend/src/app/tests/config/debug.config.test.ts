import { DEBUG_CONFIG } from '../../config/debug.config';

describe('Debug Configuration', () => {
  it('should have valid update interval', () => {
    expect(DEBUG_CONFIG.update_interval).toBeGreaterThan(0);
    expect(DEBUG_CONFIG.update_interval).toBeLessThanOrEqual(10000);
  });

  it('should have valid retention limits', () => {
    expect(DEBUG_CONFIG.retention.max_logs).toBeGreaterThan(0);
    expect(DEBUG_CONFIG.retention.max_age_ms).toBeGreaterThan(0);
  });

  it('should have valid system thresholds', () => {
    expect(DEBUG_CONFIG.thresholds.system.latency).toBeGreaterThan(0);
    expect(DEBUG_CONFIG.thresholds.system.error_rate).toBeGreaterThan(0);
    expect(DEBUG_CONFIG.thresholds.system.error_rate).toBeLessThan(1);
    expect(DEBUG_CONFIG.thresholds.system.resource_usage).toBeGreaterThan(0);
    expect(DEBUG_CONFIG.thresholds.system.resource_usage).toBeLessThan(1);
  });

  it('should have valid trading thresholds', () => {
    expect(DEBUG_CONFIG.thresholds.trading.min_balance).toBeGreaterThan(0);
    expect(DEBUG_CONFIG.thresholds.trading.max_slippage).toBeGreaterThan(0);
    expect(DEBUG_CONFIG.thresholds.trading.max_slippage).toBeLessThan(1);
  });

  it('should have valid wallet thresholds', () => {
    expect(DEBUG_CONFIG.thresholds.wallet.min_confirmations).toBeGreaterThan(0);
    expect(DEBUG_CONFIG.thresholds.wallet.max_pending_transactions).toBeGreaterThan(0);
  });

  it('should have valid API thresholds', () => {
    expect(DEBUG_CONFIG.thresholds.api.timeout_ms).toBeGreaterThan(0);
    expect(DEBUG_CONFIG.thresholds.api.retry_count).toBeGreaterThan(0);
    expect(DEBUG_CONFIG.thresholds.api.retry_delay_ms).toBeGreaterThan(0);
  });

  it('should have valid logging levels', () => {
    expect(DEBUG_CONFIG.logging.levels).toContain('error');
    expect(DEBUG_CONFIG.logging.levels).toContain('warn');
    expect(DEBUG_CONFIG.logging.levels).toContain('info');
    expect(DEBUG_CONFIG.logging.levels).toContain('debug');
  });

  it('should have valid metrics configuration', () => {
    expect(DEBUG_CONFIG.metrics.collection_interval).toBeGreaterThan(0);
    expect(DEBUG_CONFIG.metrics.storage_duration).toBeGreaterThan(0);
    expect(DEBUG_CONFIG.metrics.batch_size).toBeGreaterThan(0);
  });

  it('should have valid alert thresholds', () => {
    expect(DEBUG_CONFIG.alerts.error_threshold).toBeGreaterThan(0);
    expect(DEBUG_CONFIG.alerts.warning_threshold).toBeGreaterThan(0);
    expect(DEBUG_CONFIG.alerts.error_threshold).toBeGreaterThan(
      DEBUG_CONFIG.alerts.warning_threshold
    );
  });

  it('should have valid performance thresholds', () => {
    expect(DEBUG_CONFIG.thresholds.performance.cpu_usage).toBeGreaterThan(0);
    expect(DEBUG_CONFIG.thresholds.performance.memory_usage).toBeGreaterThan(0);
    expect(DEBUG_CONFIG.thresholds.performance.disk_usage).toBeGreaterThan(0);
  });
});
