import asyncio
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import pytest

from src.backend.data_infrastructure.monitoring import Monitoring, PerformanceMetrics


@pytest.fixture
def monitoring():
    """创建Monitoring实例"""
    config = {"metrics_ttl": 3600, "alert_threshold": 0.9, "sampling_interval": 1}
    return Monitoring(config)


@pytest.fixture
def sample_metrics():
    """创建示例性能指标"""
    return PerformanceMetrics(
        timestamp=datetime.now(),
        data_type="market",
        processing_time=1.0,
        batch_size=100,
        queue_size=500,
        memory_usage=1000000000,  # 1GB
        cpu_usage=50.0,
        cache_hits=80,
        cache_misses=20,
        error_count=1,
    )


class TestMonitoring:
    def test_metrics_recording(self, monitoring, sample_metrics):
        """测试指标记录"""
        # 记录指标
        monitoring.record_metrics(sample_metrics)

        # 验证记录结果
        assert len(monitoring.metrics_history["market"]) == 1
        recorded_metrics = monitoring.metrics_history["market"][0]

        # 验证指标值
        assert recorded_metrics.processing_time == sample_metrics.processing_time
        assert recorded_metrics.batch_size == sample_metrics.batch_size
        assert recorded_metrics.queue_size == sample_metrics.queue_size

    def test_metrics_cleanup(self, monitoring, sample_metrics):
        """测试指标清理"""
        # 添加过期指标
        old_metrics = sample_metrics
        old_metrics.timestamp = datetime.now() - timedelta(seconds=7200)
        monitoring.record_metrics(old_metrics)

        # 添加新指标
        new_metrics = sample_metrics
        new_metrics.timestamp = datetime.now()
        monitoring.record_metrics(new_metrics)

        # 清理过期指标
        monitoring._cleanup_old_metrics()

        # 验证结果
        assert len(monitoring.metrics_history["market"]) == 1
        assert monitoring.metrics_history["market"][0].timestamp > (
            datetime.now() - timedelta(seconds=3600)
        )

    def test_alert_generation(self, monitoring):
        """测试告警生成"""
        # 创建触发告警的指标
        alert_metrics = PerformanceMetrics(
            timestamp=datetime.now(),
            data_type="market",
            processing_time=10.0,  # 高处理时间
            batch_size=100,
            queue_size=20000,  # 大队列
            memory_usage=3000000000,  # 高内存使用
            cpu_usage=90.0,  # 高CPU使用
            cache_hits=20,
            cache_misses=80,  # 低缓存命中率
            error_count=5,  # 高错误率
        )

        # 记录指标
        monitoring.record_metrics(alert_metrics)

        # 验证告警
        assert len(monitoring.alerts_history) > 0
        alert = monitoring.alerts_history[0]

        # 验证告警类型
        alert_types = [a["type"] for a in alert["alerts"]]
        assert "processing_time" in alert_types
        assert "queue_size" in alert_types
        assert "memory_usage" in alert_types
        assert "cpu_usage" in alert_types
        assert "cache_hit_rate" in alert_types

    def test_metrics_summary(self, monitoring, sample_metrics):
        """测试指标统计摘要"""
        # 记录多个指标
        for _ in range(5):
            metrics = sample_metrics
            metrics.processing_time += np.random.normal(0, 0.1)
            monitoring.record_metrics(metrics)

        # 获取摘要
        summary = monitoring.get_metrics_summary("market")

        # 验证摘要内容
        assert "processing_time" in summary
        assert "queue_size" in summary
        assert "memory_usage" in summary
        assert "cpu_usage" in summary
        assert "cache_stats" in summary

        # 验证统计值
        processing_time = summary["processing_time"]
        assert all(
            key in processing_time for key in ["mean", "std", "min", "max", "p95"]
        )

    def test_alerts_summary(self, monitoring):
        """测试告警摘要"""
        # 创建多个告警
        for _ in range(3):
            alert_metrics = PerformanceMetrics(
                timestamp=datetime.now(),
                data_type="market",
                processing_time=10.0,
                batch_size=100,
                queue_size=20000,
                memory_usage=3000000000,
                cpu_usage=90.0,
                cache_hits=20,
                cache_misses=80,
                error_count=5,
            )
            monitoring.record_metrics(alert_metrics)

        # 获取告警摘要
        alerts = monitoring.get_alerts_summary()

        # 验证摘要内容
        assert len(alerts) > 0
        for alert in alerts:
            assert "type" in alert
            assert "count" in alert
            assert "examples" in alert
            assert len(alert["examples"]) <= 3

    def test_error_summary(self, monitoring):
        """测试错误摘要"""
        # 添加一些错误
        for _ in range(3):
            monitoring.error_history.append(
                {
                    "timestamp": datetime.now(),
                    "error": "Test error",
                    "component": "test",
                }
            )

        # 获取错误摘要
        errors = monitoring.get_error_summary()

        # 验证摘要内容
        assert len(errors) > 0
        for error in errors:
            assert "component" in error
            assert "error" in error
            assert "count" in error
            assert "last_occurrence" in error

    @pytest.mark.asyncio
    async def test_monitoring_start(self, monitoring):
        """测试监控启动"""
        # 启动监控任务
        monitor_task = asyncio.create_task(monitoring.start_monitoring())

        # 等待几个监控周期
        await asyncio.sleep(2)

        # 取消监控任务
        monitor_task.cancel()
        try:
            await monitor_task
        except asyncio.CancelledError:
            pass

        # 验证系统指标是否被收集
        assert len(monitoring.metrics_history["system"]) > 0

    def test_system_metrics_collection(self, monitoring):
        """测试系统指标收集"""
        # 收集系统指标
        metrics = monitoring._collect_system_metrics()

        # 验证指标
        assert "memory_usage" in metrics
        assert "cpu_usage" in metrics
        assert "open_files" in metrics
        assert "threads" in metrics
        assert "connections" in metrics

    def test_monitoring_report_generation(self, monitoring, sample_metrics):
        """测试监控报告生成"""
        # 记录一些指标
        monitoring.record_metrics(sample_metrics)

        # 生成报告
        monitoring._generate_monitoring_report()

        # 验证报告缓存
        cache_keys = [
            key
            for key in monitoring.cache.keys()
            if key.startswith("monitoring_report_")
        ]
        assert len(cache_keys) > 0

    def test_error_handling(self, monitoring):
        """测试错误处理"""
        # 测试无效指标
        invalid_metrics = None
        monitoring.record_metrics(invalid_metrics)

        # 验证错误记录
        assert len(monitoring.error_history) > 0
        assert monitoring.error_history[0]["component"] == "monitoring"

    def test_performance_under_load(self, monitoring):
        """测试高负载下的性能"""
        # 生成大量指标
        for _ in range(1000):
            metrics = PerformanceMetrics(
                timestamp=datetime.now(),
                data_type="market",
                processing_time=np.random.normal(1.0, 0.1),
                batch_size=100,
                queue_size=np.random.randint(100, 1000),
                memory_usage=np.random.randint(1000000, 2000000),
                cpu_usage=np.random.uniform(20, 80),
                cache_hits=np.random.randint(50, 100),
                cache_misses=np.random.randint(0, 50),
                error_count=np.random.randint(0, 3),
            )
            monitoring.record_metrics(metrics)

        # 验证性能
        summary = monitoring.get_metrics_summary("market")
        assert summary is not None
        assert len(monitoring.metrics_history["market"]) <= monitoring.metrics_ttl

    @pytest.mark.asyncio
    async def test_cross_component_monitoring(self, monitoring):
        """Test monitoring across Python and Go components."""
        # Test Go component metrics collection
        go_metrics = await monitoring.collect_go_metrics()
        assert isinstance(go_metrics, dict)
        assert "processing_time" in go_metrics
        assert "memory_usage" in go_metrics
        assert "goroutine_count" in go_metrics
        assert all(isinstance(v, (int, float)) for v in go_metrics.values())
        
        # Test Python component metrics
        py_metrics = await monitoring.collect_python_metrics()
        assert isinstance(py_metrics, dict)
        assert "cpu_usage" in py_metrics
        assert "memory_usage" in py_metrics
        assert "thread_count" in py_metrics
        assert all(isinstance(v, (int, float)) for v in py_metrics.values())
        
        # Test IPC channel monitoring
        ipc_metrics = await monitoring.monitor_ipc_channels()
        assert isinstance(ipc_metrics, dict)
        assert "latency" in ipc_metrics
        assert "error_rate" in ipc_metrics
        assert "message_rate" in ipc_metrics
        assert all(isinstance(v, (int, float)) for v in ipc_metrics.values())
        
        # Test component health status
        health_status = await monitoring.check_component_health()
        assert isinstance(health_status, dict)
        assert "go_components" in health_status
        assert "python_components" in health_status
        assert "ipc_channels" in health_status
        assert all(isinstance(v, dict) for v in health_status.values())
        
        # Test alert generation
        alerts = await monitoring.check_cross_component_alerts()
        assert isinstance(alerts, list)
        for alert in alerts:
            assert "type" in alert
            assert "component" in alert
            assert "threshold" in alert
            assert "current_value" in alert
            assert "timestamp" in alert
