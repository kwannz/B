import asyncio
from datetime import datetime, timedelta

import pytest
import numpy as np

from tradingbot.backend.monitoring.performance_monitor import PerformanceMonitor


@pytest.fixture
def performance_monitor():
    """Create PerformanceMonitor instance for testing."""
    config = {
        "sampling_interval": 1,
        "metrics_ttl": 3600,
        "alert_thresholds": {
            "latency": 1000,
            "memory": 85,
            "cpu": 90,
            "error_rate": 0.01
        }
    }
    return PerformanceMonitor(config)


@pytest.mark.asyncio
async def test_system_performance(performance_monitor):
    """Test system performance monitoring and metrics collection."""
    # Test performance metrics collection
    metrics = await performance_monitor.collect_performance_metrics()
    assert isinstance(metrics, dict)
    assert "processing_latency" in metrics
    assert "queue_sizes" in metrics
    assert "memory_usage" in metrics
    assert "cpu_usage" in metrics
    assert all(isinstance(v, (int, float)) for v in metrics.values())
    
    # Test historical metrics tracking
    await performance_monitor.record_metrics(metrics)
    history = await performance_monitor.get_metrics_history()
    assert len(history) > 0
    assert all(isinstance(m, dict) for m in history)
    
    # Test system load analysis
    load_metrics = await performance_monitor.analyze_system_load()
    assert "average_latency" in load_metrics
    assert "peak_memory" in load_metrics
    assert "average_cpu" in load_metrics
    assert "bottlenecks" in load_metrics
    
    # Test resource utilization tracking
    utilization = await performance_monitor.track_resource_utilization()
    assert "memory_trend" in utilization
    assert "cpu_trend" in utilization
    assert "io_stats" in utilization
    assert all(isinstance(v, dict) for v in utilization.values())
    
    # Test alert generation
    test_metrics = {
        "processing_latency": 2000,  # Above threshold
        "memory_usage": 90,  # Above threshold
        "cpu_usage": 50,
        "error_rate": 0.005
    }
    alerts = await performance_monitor.check_performance_alerts(test_metrics)
    assert isinstance(alerts, list)
    assert len(alerts) >= 2  # Should have at least latency and memory alerts
    for alert in alerts:
        assert "type" in alert
        assert "threshold" in alert
        assert "current_value" in alert
        assert "timestamp" in alert
    
    # Test performance trend analysis
    trend_data = await performance_monitor.analyze_performance_trends(
        start_time=datetime.now() - timedelta(hours=1),
        end_time=datetime.now()
    )
    assert "latency_trend" in trend_data
    assert "resource_usage_trend" in trend_data
    assert "error_rate_trend" in trend_data
    
    # Test system health score calculation
    health_score = await performance_monitor.calculate_system_health()
    assert isinstance(health_score, float)
    assert 0 <= health_score <= 100
    
    # Test bottleneck detection
    bottlenecks = await performance_monitor.detect_bottlenecks()
    assert isinstance(bottlenecks, list)
    for bottleneck in bottlenecks:
        assert "component" in bottleneck
        assert "severity" in bottleneck
        assert "metrics" in bottleneck
