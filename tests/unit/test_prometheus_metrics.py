"""
Prometheus指标测试
"""

import os
import pytest
from unittest.mock import Mock, patch, MagicMock
from prometheus_client import CollectorRegistry, Gauge, Counter, Histogram

from tradingbot.shared.real_time_monitor import RealTimeMonitor


@pytest.fixture(autouse=True)
def mock_prometheus():
    """Mock Prometheus client components"""
    with patch("prometheus_client.CollectorRegistry") as mock_registry, patch(
        "prometheus_client.Gauge"
    ) as mock_gauge, patch("prometheus_client.Counter") as mock_counter, patch(
        "prometheus_client.Histogram"
    ) as mock_histogram, patch(
        "prometheus_client.push_to_gateway"
    ) as mock_push:

        # Setup mock registry
        registry = MagicMock()
        mock_registry.return_value = registry

        # Create mock metric instances with proper method chaining
        def create_metric_mock():
            metric = MagicMock()

            # Create a dict to store label instances
            label_instances = {}

            def get_label_instance(component):
                if component not in label_instances:
                    instance = MagicMock()
                    instance.component = component
                    instance.inc_calls = []
                    instance.set_calls = []
                    instance.observe_calls = []
                    instance.value_calls = []
                    instance.inc = MagicMock(
                        side_effect=lambda x=1: instance.inc_calls.append(x) or instance
                    )
                    instance.set = MagicMock(
                        side_effect=lambda x: instance.set_calls.append(x) or instance
                    )
                    instance.observe = MagicMock(
                        side_effect=lambda x: instance.observe_calls.append(x)
                        or instance
                    )
                    label_instances[component] = instance
                return label_instances[component]

            def track_labels(*args, **kwargs):
                component = kwargs.get("component", "default")
                instance = get_label_instance(component)
                instance.inc_calls = []
                instance.set_calls = []
                instance.observe_calls = []
                metric.all_label_calls.append((args, kwargs))
                metric._current_instance = instance
                return instance

            def track_inc(value=1):
                instance = metric._current_instance
                if instance:
                    instance.inc.called = True
                    instance.inc_calls.append(value)
                    instance.value_calls.append(value)
                metric.inc_calls.append(value)
                metric.value_calls.append(value)
                return instance

            def track_set(value):
                instance = metric._current_instance
                if instance:
                    instance.set.called = True
                    instance.set_calls.append(value)
                    instance.value_calls.append(value)
                metric.set_calls.append(value)
                metric.value_calls.append(value)
                return instance

            def track_observe(value):
                instance = metric._current_instance
                if instance:
                    instance.observe.called = True
                    instance.observe_calls.append(value)
                    instance.value_calls.append(value)
                metric.observe_calls.append(value)
                metric.value_calls.append(value)
                return instance

            # Setup mock attributes
            metric.all_label_calls = []
            metric.inc_calls = []
            metric.set_calls = []
            metric.observe_calls = []
            metric.value_calls = []  # Track all value changes
            metric.label_instances = label_instances
            metric._current_instance = None  # Track current labeled instance

            # Setup labels method
            metric.labels = MagicMock(side_effect=track_labels)

            # Setup default instance methods
            default_instance = get_label_instance("default")
            default_instance.inc = MagicMock(side_effect=track_inc)
            default_instance.set = MagicMock(side_effect=track_set)
            default_instance.observe = MagicMock(side_effect=track_observe)
            default_instance.value_calls = metric.value_calls  # Share value tracking

            return metric

        # Create mock metrics
        gauge = create_metric_mock()
        counter = create_metric_mock()
        histogram = create_metric_mock()

        # Setup constructors
        mock_gauge.return_value = gauge
        mock_counter.return_value = counter
        mock_histogram.return_value = histogram

        # Reset all mocks before each test
        mock_push.reset_mock()
        gauge.reset_mock()
        counter.reset_mock()
        histogram.reset_mock()

        yield {
            "registry": registry,
            "gauge": mock_gauge,
            "counter": mock_counter,
            "histogram": mock_histogram,
            "push": mock_push,
        }


@pytest.fixture
async def monitor(mock_prometheus):
    """创建监控器实例"""
    # Enable Prometheus for tests
    os.environ["USE_PROMETHEUS"] = "true"

    # Create mock metrics with proper method tracking
    def create_tracked_mock(mock_class, name):
        mock = mock_class()
        mock.name = name
        mock.label_instances = {}
        mock.all_label_calls = []
        mock.inc_calls = []
        mock.set_calls = []
        mock.observe_calls = []

        def get_label_instance(**kwargs):
            key = tuple(sorted(kwargs.items()))
            if key not in mock.label_instances:
                instance = MagicMock()
                instance.labels = kwargs
                instance.inc_calls = []
                instance.set_calls = []
                instance.observe_calls = []
                instance.inc = MagicMock()
                instance.set = MagicMock()
                instance.observe = MagicMock()

                def track_inc(value=1):
                    instance.inc.called = True
                    instance.inc_calls.append(value)
                    mock.inc_calls.append(value)
                    mock.all_label_calls.append(kwargs)  # Track label usage
                    return instance

                def track_set(value):
                    instance.set.called = True
                    instance.set_calls.append(value)
                    mock.set_calls.append(value)
                    mock.all_label_calls.append(kwargs)  # Track label usage
                    return instance

                def track_observe(value):
                    instance.observe.called = True
                    instance.observe_calls.append(value)
                    mock.observe_calls.append(value)
                    mock.all_label_calls.append(kwargs)  # Track label usage
                    return instance

                instance.inc.side_effect = track_inc
                instance.set.side_effect = track_set
                instance.observe.side_effect = track_observe
                mock.label_instances[key] = instance
            return mock.label_instances[key]

        def track_labels(**kwargs):
            instance = get_label_instance(**kwargs)
            return instance

        # Create default instance for metrics without labels
        default_instance = get_label_instance()

        # Setup mock methods to use default instance
        mock.inc = default_instance.inc
        mock.set = default_instance.set
        mock.observe = default_instance.observe
        mock.labels = MagicMock(side_effect=track_labels)

        return mock

    # Create separate mock instances for each metric type
    response_histogram = create_tracked_mock(
        mock_prometheus["histogram"], "response_histogram"
    )
    error_counter = create_tracked_mock(mock_prometheus["counter"], "error_counter")
    error_rate_gauge = create_tracked_mock(mock_prometheus["gauge"], "error_rate_gauge")
    cpu_gauge = create_tracked_mock(mock_prometheus["gauge"], "cpu_gauge")
    memory_gauge = create_tracked_mock(mock_prometheus["gauge"], "memory_gauge")
    connections_gauge = create_tracked_mock(
        mock_prometheus["gauge"], "connections_gauge"
    )
    ws_connected = create_tracked_mock(mock_prometheus["gauge"], "ws_connected")
    ws_messages = create_tracked_mock(mock_prometheus["counter"], "ws_messages")
    ws_latency = create_tracked_mock(mock_prometheus["histogram"], "ws_latency")

    monitor = RealTimeMonitor()
    # Disable periodic tasks for tests and inject mock metrics
    await monitor.initialize(
        start_periodic_tasks=False,
        mock_metrics={
            "registry": mock_prometheus["registry"],
            "response_histogram": response_histogram,
            "error_counter": error_counter,
            "error_rate_gauge": error_rate_gauge,
            "cpu_gauge": cpu_gauge,
            "memory_gauge": memory_gauge,
            "connections_gauge": connections_gauge,
            "ws_connected": ws_connected,
            "ws_messages": ws_messages,
            "ws_latency": ws_latency,
        },
    )
    yield monitor
    await monitor.close()

    # Reset environment
    os.environ["USE_PROMETHEUS"] = "false"


@pytest.mark.asyncio
async def test_system_metrics(monitor):
    """测试系统指标推送"""
    # Get system metrics
    metrics = await monitor.get_system_metrics()

    # Verify metrics were collected
    assert "cpu_usage" in metrics
    assert "memory_usage" in metrics
    assert "active_connections" in metrics

    # Get metrics from monitor
    cpu_gauge = monitor.cpu_gauge
    memory_gauge = monitor.memory_gauge
    connections_gauge = monitor.connections_gauge

    # Get labeled instances (system metrics don't have labels)
    cpu_instance = cpu_gauge.label_instances.get(tuple([]))
    memory_instance = memory_gauge.label_instances.get(tuple([]))
    connections_instance = connections_gauge.label_instances.get(tuple([]))

    # Print debug info
    print("\nSystem Metrics Test Debug Info:")
    print(f"CPU Set Calls: {cpu_instance.set_calls if cpu_instance else []}")
    print(f"Memory Set Calls: {memory_instance.set_calls if memory_instance else []}")
    print(
        f"Connections Set Calls: {connections_instance.set_calls if connections_instance else []}"
    )

    # Verify instances were created
    assert cpu_instance is not None, "CPU gauge instance not found"
    assert memory_instance is not None, "Memory gauge instance not found"
    assert connections_instance is not None, "Connections gauge instance not found"

    # Verify metric values
    assert any(
        isinstance(v, (int, float)) and v > 0 for v in cpu_instance.set_calls
    ), "CPU usage not set"
    assert any(
        isinstance(v, (int, float)) and v > 0 for v in memory_instance.set_calls
    ), "Memory usage not set"
    assert any(
        isinstance(v, (int, float)) and v >= 0 for v in connections_instance.set_calls
    ), "Active connections not set"


@pytest.mark.asyncio
async def test_websocket_metrics(monitor):
    """测试WebSocket指标推送"""
    # Push WebSocket metrics
    test_data = {
        "exchange": "binance",
        "connected": True,
        "message_counts": {"trade": 100, "orderbook": 50},
        "latency": 0.1,
    }
    await monitor._push_to_prometheus("websocket", test_data)

    # Get metrics from monitor
    ws_connected = monitor.ws_connected
    ws_messages = monitor.ws_messages
    ws_latency = monitor.ws_latency

    # Get labeled instances from label_instances dict
    binance_status = ws_connected.label_instances.get(tuple([("exchange", "binance")]))
    trade_counter = ws_messages.label_instances.get(
        tuple([("exchange", "binance"), ("type", "trade")])
    )
    orderbook_counter = ws_messages.label_instances.get(
        tuple([("exchange", "binance"), ("type", "orderbook")])
    )
    latency_hist = ws_latency.label_instances.get(tuple([("exchange", "binance")]))

    # Print debug info
    print("\nWebSocket Metrics Test Debug Info:")
    print(
        f"Connection Status Set Calls: {binance_status.set_calls if binance_status else []}"
    )
    print(
        f"Trade Counter Inc Calls: {trade_counter.inc_calls if trade_counter else []}"
    )
    print(
        f"Orderbook Counter Inc Calls: {orderbook_counter.inc_calls if orderbook_counter else []}"
    )
    print(
        f"Latency Histogram Observe Calls: {latency_hist.observe_calls if latency_hist else []}"
    )

    # Verify instances were created
    assert binance_status is not None, "Binance status instance not found"
    assert trade_counter is not None, "Trade counter instance not found"
    assert orderbook_counter is not None, "Orderbook counter instance not found"
    assert latency_hist is not None, "Latency histogram instance not found"

    # Verify connection status
    assert binance_status.set.called, "Connection status not set"
    assert any(
        v == 1 for v in binance_status.set_calls
    ), "Connection status not set to 1"

    # Verify message counts
    assert trade_counter.inc.called, "Trade counter not incremented"
    assert orderbook_counter.inc.called, "Orderbook counter not incremented"
    assert any(v == 100 for v in trade_counter.inc_calls), "Trade count incorrect"
    assert any(
        v == 50 for v in orderbook_counter.inc_calls
    ), "Orderbook count incorrect"

    # Verify latency metrics
    assert latency_hist.observe.called, "Latency not observed"
    assert any(
        abs(v - 0.1) < 0.001 for v in latency_hist.observe_calls
    ), "Latency value incorrect"


@pytest.mark.asyncio
async def test_performance_metrics(monitor):
    """测试性能指标推送"""
    # Record some test data
    await monitor.record_request("test_component", 0.1, False)
    await monitor.record_request("test_component", 0.2, True)

    # Get performance stats
    stats = await monitor.get_performance_stats()

    # Verify metrics were collected
    assert "response_times" in stats
    assert "error_rates" in stats
    assert "throughput" in stats

    # Get metrics from monitor
    response_histogram = monitor.response_histogram
    error_counter = monitor.error_counter
    error_rate_gauge = monitor.error_rate_gauge

    # Get labeled instances
    test_histogram = response_histogram.label_instances.get(
        tuple([("component", "test_component")])
    )
    test_counter = error_counter.label_instances.get(
        tuple([("component", "test_component")])
    )
    test_gauge = error_rate_gauge.label_instances.get(
        tuple([("component", "test_component")])
    )

    # Print debug info
    print("\nPerformance Metrics Test Debug Info:")
    print(
        f"Response Time Observe Calls: {test_histogram.observe_calls if test_histogram else []}"
    )
    print(f"Error Counter Inc Calls: {test_counter.inc_calls if test_counter else []}")
    print(f"Error Rate Set Calls: {test_gauge.set_calls if test_gauge else []}")

    # Verify instances were created
    assert test_histogram is not None, "Response histogram instance not found"
    assert test_counter is not None, "Error counter instance not found"
    assert test_gauge is not None, "Error rate gauge instance not found"

    # Verify response time histogram
    assert any(
        abs(v - 0.1) < 0.001 for v in test_histogram.observe_calls
    ), "Response time 0.1s not recorded"
    assert any(
        abs(v - 0.2) < 0.001 for v in test_histogram.observe_calls
    ), "Response time 0.2s not recorded"

    # Verify error counter
    assert test_counter.inc.called, "Error counter not incremented"
    assert any(v == 1 for v in test_counter.inc_calls), "Error count incorrect"

    # Verify error rate gauge
    assert test_gauge.set.called, "Error rate not set"
    assert any(
        abs(v - 0.5) < 0.001 for v in test_gauge.set_calls
    ), "Error rate not set to 50%"


@pytest.mark.asyncio
async def test_health_metrics(monitor, mock_prometheus):
    """测试健康状态指标推送"""
    # Check component health
    health_status = await monitor.check_component_health()

    # Verify health gauge metric
    mock_prometheus["gauge"].assert_any_call(
        "tradingbot_component_health",
        "Component Health Status",
        ["component"],
        registry=mock_prometheus["registry"],
    )

    # Verify each component's health status
    for component in ["news_collector", "ai_analyzer", "risk_controller"]:
        mock_prometheus["gauge"].return_value.labels.assert_any_call(
            component=component
        )
        mock_prometheus["gauge"].return_value.labels.return_value.set.assert_called()


@pytest.mark.asyncio
async def test_error_metrics(monitor, mock_prometheus):
    """测试错误指标推送"""
    # Simulate some errors
    for _ in range(5):
        await monitor.record_request("error_test", 0.1, True)

    # Get performance stats to trigger metrics push
    await monitor.get_performance_stats()

    # Get error rates
    error_rates = monitor._calculate_error_rates()

    # Verify error metrics
    assert "error_test" in error_rates
    assert error_rates["error_test"] == 1.0  # All requests were errors

    # Get counter instance
    counter_instance = mock_prometheus["counter"].return_value

    # Verify error counter creation
    mock_prometheus["counter"].assert_called_with(
        "tradingbot_errors_total",
        "Total number of errors",
        ["component"],
        registry=mock_prometheus["registry"],
    )

    # Verify labels were set correctly
    assert any(
        kwargs == {"component": "error_test"}
        for args, kwargs in counter_instance.all_label_calls
    ), "Counter labels not set correctly"

    # Verify error count
    assert counter_instance.inc_calls, "Error counter not incremented"
    assert 5 in counter_instance.value_calls, "Error count incorrect"

    # Verify error rate gauge
    mock_prometheus["gauge"].assert_any_call(
        "tradingbot_error_rate",
        "Error Rate",
        ["component"],
        registry=mock_prometheus["registry"],
    )
    mock_prometheus["gauge"].return_value.labels.assert_called_with(
        component="error_test"
    )
    mock_prometheus["gauge"].return_value.labels.return_value.set.assert_called_with(
        1.0
    )
