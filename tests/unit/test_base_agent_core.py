import pytest
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from functools import wraps
from tradingbot.backend.trading_agent.agents.base_agent import BaseAgent
from tradingbot.shared.monitor.metrics import (
    get_cache_hit_rate,
    get_error_rate,
    get_inference_latency,
    track_cache_hit,
    track_cache_miss,
    track_inference_time,
    reset_metrics,
    track_error,
)
from datetime import datetime
from typing import Any

@pytest.fixture
def mock_config():
    return {
        "name": "test_agent",
        "type": "base",
        "enabled": True,
        "parameters": {
            "param1": "value1",
            "param2": "value2"
        }
    }

class TestAgent(BaseAgent):
    """Concrete implementation of BaseAgent for testing"""
    def __init__(self, config):
        if not config.get("name") or not config.get("type"):
            raise KeyError("Missing required fields: name and type")
        if not isinstance(config.get("parameters"), dict):
            raise ValueError("Parameters must be a dictionary")
        super().__init__(config["name"], config["type"], config)
        
    async def start(self):
        """Start agent"""
        await super().start()
        self.status = "active"
        self.last_update = datetime.now().isoformat()
        
    async def stop(self):
        """Stop agent"""
        self.status = "inactive"
        self.last_update = datetime.now().isoformat()
        
    async def update_config(self, new_config):
        """Update config"""
        self.config = new_config
        self.last_update = datetime.now().isoformat()

@pytest.fixture
def base_agent(mock_config):
    return TestAgent(mock_config)

def test_base_agent_initialization(base_agent, mock_config):
    """Test agent initialization"""
    assert base_agent.name == mock_config["name"]
    assert base_agent.type == mock_config["type"]
    assert base_agent.config == mock_config
    assert base_agent.status == "inactive"
    assert base_agent.last_update is None
    assert hasattr(base_agent, "cache")

@pytest.mark.asyncio
async def test_base_agent_start_prometheus(base_agent):
    """Test agent start with prometheus initialization"""
    with patch('tradingbot.backend.trading_agent.agents.base_agent.start_prometheus_server') as mock_start:
        # Ensure _prometheus_started is not set
        if hasattr(BaseAgent, "_prometheus_started"):
            delattr(BaseAgent, "_prometheus_started")
            
        await base_agent.start()
        mock_start.assert_called_once()
        assert hasattr(BaseAgent, "_prometheus_started")

@pytest.mark.asyncio
async def test_base_agent_start_prometheus_once(base_agent):
    """Test prometheus server is started only once"""
    with patch('tradingbot.backend.trading_agent.agents.base_agent.start_prometheus_server') as mock_start:
        # Ensure _prometheus_started is not set
        if hasattr(BaseAgent, "_prometheus_started"):
            delattr(BaseAgent, "_prometheus_started")
            
        # First start
        await base_agent.start()
        mock_start.assert_called_once()
        
        # Second start
        mock_start.reset_mock()
    await base_agent.start()
        mock_start.assert_not_called()

@pytest.mark.asyncio
async def test_base_agent_process_request_cache_hit(base_agent):
    """Test request processing with cache hit"""
    request = {"cache_key": "test_key", "data": "test_data"}
    cached_response = {"result": "cached"}
    
    with patch.object(base_agent.cache, 'get', return_value=cached_response):
        result = await base_agent._process_request(request)
        assert result == cached_response

@pytest.mark.asyncio
async def test_base_agent_process_request_cache_miss(base_agent):
    """Test request processing with cache miss"""
    request = {"cache_key": "test_key", "data": "test_data"}
    
    with patch.object(base_agent.cache, 'get', return_value=None):
        result = await base_agent._process_request(request)
        assert result == {}

@pytest.mark.asyncio
async def test_base_agent_process_request_no_cache_key(base_agent):
    """Test request processing without cache key"""
    request = {"data": "test_data"}  # No cache_key
    
    with patch.object(base_agent.cache, 'get', return_value=None) as mock_get:
        with pytest.raises(ValueError) as exc_info:
            await base_agent._process_request(request)
        assert "cache_key is required" in str(exc_info.value)
        mock_get.assert_not_called()

@pytest.mark.asyncio
async def test_base_agent_process_request_error(base_agent):
    """Test request processing with error"""
    request = {"cache_key": "test_key"}
    
    with patch.object(base_agent.cache, 'get', side_effect=Exception("Cache error")):
        with pytest.raises(Exception, match="Cache error"):
            await base_agent._process_request(request)

@pytest.mark.asyncio
async def test_base_agent_update_config(base_agent):
    """Test config update"""
    new_config = {
        "name": "updated_agent",
        "type": "base",
        "enabled": False,
        "parameters": {"new_param": "new_value"}
    }
    
    await base_agent.update_config(new_config)
    assert base_agent.config == new_config

def test_base_agent_get_status_no_warnings(base_agent):
    """Test status retrieval with good metrics"""
    with patch.multiple('tradingbot.backend.trading_agent.agents.base_agent',
                       get_cache_hit_rate=Mock(return_value=0.8),
                       get_error_rate=Mock(return_value=0.001),
                       get_inference_latency=Mock(return_value=0.05)):
        
        status = base_agent.get_status()
        assert status["name"] == base_agent.name
        assert status["status"] == base_agent.status
        assert "metrics" in status
        assert "warnings" not in status

def test_base_agent_get_status_with_warnings(base_agent):
    """Test status retrieval with warnings"""
    with patch.multiple('tradingbot.backend.trading_agent.agents.base_agent',
                       get_cache_hit_rate=Mock(return_value=0.5),  # Below target 0.65
                       get_error_rate=Mock(return_value=0.01),     # Above target 0.005
                       get_inference_latency=Mock(return_value=0.2)): # Above target 0.1
        
        status = base_agent.get_status()
        assert "warnings" in status
        warnings = status["warnings"]
        assert len(warnings) == 3
        assert "Cache hit rate below target 65%" in warnings
        assert "Error rate above target 0.5%" in warnings
        assert "Inference latency above target 100ms" in warnings

def test_base_agent_get_status_partial_warnings(base_agent):
    """Test status retrieval with some metrics in warning range"""
    with patch.multiple('tradingbot.backend.trading_agent.agents.base_agent',
                       get_cache_hit_rate=Mock(return_value=0.7),    # Good
                       get_error_rate=Mock(return_value=0.01),       # Bad
                       get_inference_latency=Mock(return_value=0.05)): # Good
        
        status = base_agent.get_status()
        assert "warnings" in status
        warnings = status["warnings"]
        assert len(warnings) == 1
        assert "Error rate above target 0.5%" in warnings

@pytest.mark.asyncio
async def test_base_agent_metrics_tracking(base_agent):
    """Test metrics tracking during request processing"""
    request = {"cache_key": "test_key"}
    
    # Test cache hit
    with patch.object(base_agent.cache, 'get', return_value={"data": "cached"}):
        with patch('tradingbot.backend.trading_agent.agents.base_agent.track_cache_hit') as mock_hit:
            await base_agent._process_request(request)
            mock_hit.assert_called_once()
    
    # Test cache miss
    with patch.object(base_agent.cache, 'get', return_value=None):
        with patch('tradingbot.backend.trading_agent.agents.base_agent.track_cache_miss') as mock_miss:
            await base_agent._process_request(request)
            mock_miss.assert_called_once()

@pytest.mark.asyncio
async def test_base_agent_inference_time_tracking(base_agent):
    """Test inference time tracking decorator"""
    request = {"cache_key": "test_key"}
    
    # Reset metrics before test
    reset_metrics()
    
    # Mock the cache get method
    with patch.object(base_agent.cache, 'get', return_value=None):
        # Call the decorated method
        await base_agent._process_request(request)
        
        # Verify inference time was tracked
        assert get_inference_latency() > 0

@pytest.mark.asyncio
async def test_base_agent_concurrent_requests(base_agent):
    """Test handling of concurrent requests"""
    import asyncio
    
    requests = [
        {"cache_key": f"key_{i}", "data": f"data_{i}"} 
        for i in range(5)
    ]
    
    with patch.object(base_agent.cache, 'get', side_effect=[None] * 5):
        tasks = [base_agent._process_request(req) for req in requests]
        results = await asyncio.gather(*tasks)
        
        assert len(results) == 5
        assert all(isinstance(r, dict) for r in results)

@pytest.mark.asyncio
async def test_base_agent_invalid_requests(base_agent):
    """Test handling of invalid requests"""
    invalid_requests = [
        None,
        "",
        [],
        42,
        True,
        {"invalid_key": "value"},  # Missing cache_key
        {"cache_key": None},
        {"cache_key": ""}
    ]
    
    for req in invalid_requests:
        with patch.object(base_agent.cache, 'get', return_value=None):
            if not isinstance(req, dict) or not req.get("cache_key"):
                with pytest.raises((AttributeError, TypeError, ValueError)) as exc_info:
                    await base_agent._process_request(req)
                assert any(msg in str(exc_info.value) for msg in [
                    "object has no attribute",
                    "must be a dictionary",
                    "cache_key is required"
                ])
            else:
                result = await base_agent._process_request(req)
                assert isinstance(result, dict)
                assert not result  # Should be empty dict

@pytest.mark.asyncio
async def test_base_agent_cache_operations(base_agent):
    """Test cache operations with different data types"""
    test_cases = [
        {"cache_key": "str_key", "data": "string_value"},
        {"cache_key": "int_key", "data": 42},
        {"cache_key": "dict_key", "data": {"nested": "value"}},
        {"cache_key": "list_key", "data": [1, 2, 3]},
        {"cache_key": "none_key", "data": None}
    ]
    
    for case in test_cases:
        # Test cache miss
        with patch.object(base_agent.cache, 'get', return_value=None) as mock_get:
            result = await base_agent._process_request({"cache_key": case["cache_key"]})
            mock_get.assert_called_once_with(case["cache_key"])
            assert result == {}
            
        # Test cache hit
        with patch.object(base_agent.cache, 'get', return_value=case["data"]) as mock_get:
            result = await base_agent._process_request({"cache_key": case["cache_key"]})
            mock_get.assert_called_once_with(case["cache_key"])
            if case["data"] is None:
                assert result == {}  # None values should be converted to empty dict
            else:
                assert result == case["data"]

@pytest.mark.asyncio
async def test_base_agent_large_request(base_agent):
    """Test handling of large request data"""
    large_data = {
        "cache_key": "large_key",
        "data": "x" * 1024 * 1024  # 1MB of data
    }
    
    with patch.object(base_agent.cache, 'get', return_value=None):
        result = await base_agent._process_request(large_data)
        assert result == {}

@pytest.mark.asyncio
async def test_base_agent_cache_error_handling(base_agent):
    """Test various cache error scenarios"""
    request = {"cache_key": "test_key"}
    
    error_cases = [
        ValueError("Invalid value"),
        KeyError("Missing key"),
        TypeError("Invalid type"),
        Exception("Unknown error")
    ]
    
    for error in error_cases:
        with patch.object(base_agent.cache, 'get', side_effect=error):
            with pytest.raises(type(error)):
                await base_agent._process_request(request)

@pytest.mark.asyncio
async def test_base_agent_metrics_edge_cases(base_agent):
    """Test metrics tracking edge cases"""
    with patch.multiple('tradingbot.backend.trading_agent.agents.base_agent',
                       get_cache_hit_rate=Mock(side_effect=[0.0, 1.0, float('nan'), float('inf')]),
                       get_error_rate=Mock(side_effect=[0.0, 1.0, float('nan'), float('inf')]),
                       get_inference_latency=Mock(side_effect=[0.0, float('inf'), float('nan')])):
        
        for _ in range(3):
            status = base_agent.get_status()
            assert "metrics" in status
            assert isinstance(status["metrics"], dict)

def test_base_agent_config_validation():
    """Test configuration validation"""
    invalid_configs = [
        {},  # Empty config
        {"name": "test"},  # Missing type
        {"type": "base"},  # Missing name
        {"name": "", "type": ""},  # Empty strings
        {"name": None, "type": None},  # None values
        {"name": "test", "type": "base", "parameters": None}  # Invalid parameters
    ]
    
    for config in invalid_configs:
        with pytest.raises((KeyError, ValueError, TypeError)) as exc_info:
            TestAgent(config)
            
        if not config.get("name") or not config.get("type"):
            assert "Missing required fields" in str(exc_info.value)
        elif config.get("parameters") is None:
            assert "Parameters must be a dictionary" in str(exc_info.value)

@pytest.mark.asyncio
async def test_base_agent_lifecycle(base_agent):
    """Test complete agent lifecycle"""
    initial_update = base_agent.last_update
    assert base_agent.status == "inactive"
    assert initial_update is None
    
    # Start agent
    with patch('tradingbot.backend.trading_agent.agents.base_agent.start_prometheus_server'):
        await base_agent.start()
        assert base_agent.status == "active"
        start_update = base_agent.last_update
        assert start_update is not None
        assert start_update != initial_update
        
        # Update config
        new_config = {
            "name": "updated",
            "type": "base",
            "enabled": True,
            "parameters": {"new": "value"}
        }
        await base_agent.update_config(new_config)
        assert base_agent.config == new_config
        config_update = base_agent.last_update
        assert config_update is not None
        assert config_update != start_update
        
        # Stop agent
        await base_agent.stop()
        assert base_agent.status == "inactive"
        stop_update = base_agent.last_update
        assert stop_update is not None
        assert stop_update != config_update
        
        # Restart agent
        await base_agent.start()
        assert base_agent.status == "active"
        restart_update = base_agent.last_update
        assert restart_update is not None
        assert restart_update != stop_update

def test_base_agent_get_status_all_warnings(base_agent):
    """Test status retrieval with poor metrics triggering all warnings"""
    with patch.multiple('tradingbot.backend.trading_agent.agents.base_agent',
                       get_cache_hit_rate=Mock(return_value=0.5),  # Below 0.65
                       get_error_rate=Mock(return_value=0.01),     # Above 0.005
                       get_inference_latency=Mock(return_value=0.2)): # Above 0.1
        
        status = base_agent.get_status()
        assert "warnings" in status
        assert len(status["warnings"]) == 3
        assert any("cache hit rate" in w.lower() for w in status["warnings"])
        assert any("error rate" in w.lower() for w in status["warnings"])
        assert any("inference latency" in w.lower() for w in status["warnings"])

def test_base_agent_get_status_partial_warnings(base_agent):
    """Test status retrieval with some metrics triggering warnings"""
    test_cases = [
        {
            'cache_hit_rate': 0.5,    # Below threshold
            'error_rate': 0.001,      # Good
            'inference_latency': 0.05  # Good
        },
        {
            'cache_hit_rate': 0.8,    # Good
            'error_rate': 0.01,       # Above threshold
            'inference_latency': 0.05  # Good
        },
        {
            'cache_hit_rate': 0.8,    # Good
            'error_rate': 0.001,      # Good
            'inference_latency': 0.2   # Above threshold
        }
    ]
    
    for case in test_cases:
        with patch.multiple('tradingbot.backend.trading_agent.agents.base_agent',
                          get_cache_hit_rate=Mock(return_value=case['cache_hit_rate']),
                          get_error_rate=Mock(return_value=case['error_rate']),
                          get_inference_latency=Mock(return_value=case['inference_latency'])):
            
            status = base_agent.get_status()
            assert "warnings" in status
            assert 0 < len(status["warnings"]) < 3
            
            if case['cache_hit_rate'] < 0.65:
                assert any("cache hit rate" in w.lower() for w in status["warnings"])
            if case['error_rate'] > 0.005:
                assert any("error rate" in w.lower() for w in status["warnings"])
            if case['inference_latency'] > 0.1:
                assert any("inference latency" in w.lower() for w in status["warnings"])

def test_base_agent_get_status_edge_metrics(base_agent):
    """Test status retrieval with edge case metric values"""
    edge_cases = [
        {
            'cache_hit_rate': 0.65,     # Exactly at threshold
            'error_rate': 0.005,        # Exactly at threshold
            'inference_latency': 0.1     # Exactly at threshold
        },
        {
            'cache_hit_rate': 0.0,      # Minimum
            'error_rate': 0.0,          # Minimum
            'inference_latency': 0.0     # Minimum
        },
        {
            'cache_hit_rate': 1.0,      # Maximum
            'error_rate': 1.0,          # Maximum
            'inference_latency': 1.0     # Maximum
        }
    ]
    
    for case in edge_cases:
        with patch.multiple('tradingbot.backend.trading_agent.agents.base_agent',
                          get_cache_hit_rate=Mock(return_value=case['cache_hit_rate']),
                          get_error_rate=Mock(return_value=case['error_rate']),
                          get_inference_latency=Mock(return_value=case['inference_latency'])):
            
            status = base_agent.get_status()
            assert isinstance(status["metrics"]["cache_hit_rate"], float)
            assert isinstance(status["metrics"]["error_rate"], float)
            assert isinstance(status["metrics"]["inference_latency"], float)
            
            if case['cache_hit_rate'] <= 0.65:
                assert any("cache hit rate" in w.lower() for w in status.get("warnings", []))
            if case['error_rate'] >= 0.005:
                assert any("error rate" in w.lower() for w in status.get("warnings", []))
            if case['inference_latency'] >= 0.1:
                assert any("inference latency" in w.lower() for w in status.get("warnings", []))

@pytest.mark.asyncio
async def test_base_agent_cache_special_values(base_agent):
    """Test cache operations with special values"""
    special_cases = [
        {"cache_key": "empty_str", "data": ""},
        {"cache_key": "empty_dict", "data": {}},
        {"cache_key": "empty_list", "data": []},
        {"cache_key": "zero", "data": 0},
        {"cache_key": "false", "data": False},
        {"cache_key": "whitespace", "data": "   "},
        {"cache_key": "special_chars", "data": "!@#$%^&*()"},
        {"cache_key": "unicode", "data": "你好世界"},
        {"cache_key": "nested", "data": {"a": {"b": {"c": None}}}}
    ]
    
    for case in special_cases:
        # Test cache hit with special values
        with patch.object(base_agent.cache, 'get', return_value=case["data"]) as mock_get:
            result = await base_agent._process_request({"cache_key": case["cache_key"]})
            mock_get.assert_called_once_with(case["cache_key"])
            assert result == case["data"]

@pytest.mark.asyncio
async def test_base_agent_cache_key_validation(base_agent):
    """Test cache key validation"""
    invalid_keys = [
        {"cache_key": ""},        # Empty string
        {"cache_key": " "},       # Whitespace
        {"cache_key": "\n"},      # Newline
        {"cache_key": "\t"},      # Tab
        {"cache_key": None},      # None
        {"cache_key": False},     # Boolean
        {"cache_key": 0},         # Number
        {"cache_key": []},        # List
        {"cache_key": {}}         # Dict
    ]
    
    for case in invalid_keys:
        with patch.object(base_agent.cache, 'get', return_value=None):
            with pytest.raises(ValueError) as exc_info:
                await base_agent._process_request(case)
            assert "cache_key is required" in str(exc_info.value)

@pytest.mark.asyncio
async def test_base_agent_cache_performance(base_agent):
    """Test cache performance with different data sizes"""
    import time
    
    data_sizes = [
        (10, "Small data"),           # 10 bytes
        (1024, "Medium data"),        # 1 KB
        (1024 * 1024, "Large data")   # 1 MB
    ]
    
    for size, label in data_sizes:
        data = "x" * size
        request = {"cache_key": f"perf_test_{size}"}
        
        # Test cache miss (should be fast)
        with patch.object(base_agent.cache, 'get', return_value=None):
            start_time = time.time()
            result = await base_agent._process_request(request)
            elapsed = time.time() - start_time
            assert elapsed < 1.0, f"Cache miss for {label} took too long: {elapsed}s"
            
        # Test cache hit (should be very fast)
        with patch.object(base_agent.cache, 'get', return_value=data):
            start_time = time.time()
            result = await base_agent._process_request(request)
            elapsed = time.time() - start_time
            assert elapsed < 0.1, f"Cache hit for {label} took too long: {elapsed}s"

@pytest.mark.asyncio
async def test_hybrid_cache_operations(base_agent):
    """Test HybridCache operations"""
    # Test set and get
    base_agent.cache.set("test_key", "test_value")
    assert base_agent.cache.get("test_key") == "test_value"
    
    # Test non-existent key
    assert base_agent.cache.get("non_existent") is None
    
    # Test delete
    base_agent.cache.delete("test_key")
    assert base_agent.cache.get("test_key") is None
    
    # Test delete non-existent key (should not raise error)
    base_agent.cache.delete("non_existent")
    
    # Test multiple sets
    test_data = {
        "str_key": "string_value",
        "int_key": 42,
        "dict_key": {"nested": "value"},
        "list_key": [1, 2, 3],
        "none_key": None
    }
    
    for key, value in test_data.items():
        base_agent.cache.set(key, value)
        assert base_agent.cache.get(key) == value
    
    # Test clear
    base_agent.cache.clear()
    for key in test_data:
        assert base_agent.cache.get(key) is None

@pytest.mark.asyncio
async def test_hybrid_cache_edge_cases(base_agent):
    """Test HybridCache edge cases"""
    edge_cases = [
        ("empty_str", ""),
        ("empty_dict", {}),
        ("empty_list", []),
        ("zero", 0),
        ("false", False),
        ("none", None),
        ("whitespace", "   "),
        ("special_chars", "!@#$%^&*()"),
        ("unicode", "你好世界"),
        ("nested", {"a": {"b": {"c": None}}})
    ]
    
    # Test setting edge cases
    for key, value in edge_cases:
        base_agent.cache.set(key, value)
        assert base_agent.cache.get(key) == value
    
    # Test overwriting values
    for key, _ in edge_cases:
        new_value = f"new_{key}"
        base_agent.cache.set(key, new_value)
        assert base_agent.cache.get(key) == new_value
    
    # Test deleting edge cases
    for key, _ in edge_cases:
        base_agent.cache.delete(key)
        assert base_agent.cache.get(key) is None

@pytest.mark.asyncio
async def test_hybrid_cache_performance(base_agent):
    """Test HybridCache performance"""
    import time
    
    # Test with different data sizes
    sizes = [
        (10, "Small"),       # 10 bytes
        (1024, "Medium"),    # 1 KB
        (1024*1024, "Large") # 1 MB
    ]
    
    for size, label in sizes:
        data = "x" * size
        key = f"perf_test_{size}"
        
        # Test set performance
        start_time = time.time()
        base_agent.cache.set(key, data)
        set_time = time.time() - start_time
        assert set_time < 1.0, f"{label} data set took too long: {set_time}s"
        
        # Test get performance
        start_time = time.time()
        result = base_agent.cache.get(key)
        get_time = time.time() - start_time
        assert get_time < 0.1, f"{label} data get took too long: {get_time}s"
        assert result == data
        
        # Test delete performance
        start_time = time.time()
        base_agent.cache.delete(key)
        delete_time = time.time() - start_time
        assert delete_time < 0.1, f"{label} data delete took too long: {delete_time}s"

@pytest.mark.asyncio
async def test_metrics_tracking_basic(base_agent):
    """Test basic metrics tracking"""
    # Reset metrics
    reset_metrics()
    
    # Test cache hit tracking
    track_cache_hit()
    assert get_cache_hit_rate() == 1.0
    
    # Test cache miss tracking
    track_cache_miss()
    assert get_cache_hit_rate() == 0.5  # 1 hit, 1 miss
    
    # Test error tracking
    track_error()
    assert get_error_rate() == 1.0  # 1 error in 1 request

@pytest.mark.asyncio
async def test_metrics_tracking_edge_cases():
    """Test metrics tracking edge cases"""
    # Reset metrics
    reset_metrics()
    
    # Test initial rates (no data)
    assert get_cache_hit_rate() == 0.0
    assert get_error_rate() == 0.0
    assert get_inference_latency() == 0.0
    
    # Test multiple hits/misses
    for _ in range(10):
        track_cache_hit()
    for _ in range(90):
        track_cache_miss()
    assert get_cache_hit_rate() == 0.1  # 10 hits in 100 total
    
    # Test error rate with multiple requests
    for _ in range(5):
        track_error()  # Also increments total_requests
    assert get_error_rate() == 1.0  # 5 errors in 5 requests

@pytest.mark.asyncio
async def test_metrics_tracking_concurrent(base_agent):
    """Test metrics tracking with concurrent requests"""
    import asyncio
    
    # Reset metrics
    reset_metrics()
    
    # Create multiple concurrent requests
    requests = [
        {"cache_key": f"key_{i}"} 
        for i in range(10)
    ]
    
    # Process requests concurrently
    with patch.object(base_agent.cache, 'get', side_effect=[None] * 5 + ["cached"] * 5):
        tasks = [base_agent._process_request(req) for req in requests]
        await asyncio.gather(*tasks)
    
    # Verify metrics
    assert get_cache_hit_rate() == 0.5  # 5 hits, 5 misses
    assert get_inference_latency() > 0  # Should have recorded some inference time

@pytest.mark.asyncio
async def test_metrics_tracking_performance():
    """Test metrics tracking performance"""
    import time
    
    # Reset metrics
    reset_metrics()
    
    # Test tracking overhead
    start_time = time.time()
    for _ in range(1000):
        track_cache_hit()
        track_cache_miss()
        track_error()
    elapsed = time.time() - start_time
    
    # Tracking 3000 metrics should take less than 1 second
    assert elapsed < 1.0, f"Metrics tracking took too long: {elapsed}s"
    
    # Verify metrics accuracy
    assert get_cache_hit_rate() == 0.5  # Equal hits and misses
    assert get_error_rate() == 1.0  # All requests had errors

@pytest.mark.asyncio
async def test_metrics_tracking_reset():
    """Test metrics reset functionality"""
    # Generate some metrics
    track_cache_hit()
    track_cache_miss()
    track_error()
    
    # Verify metrics are recorded
    assert get_cache_hit_rate() > 0
    assert get_error_rate() > 0
    
    # Reset metrics
    reset_metrics()
    
    # Verify metrics are reset
    assert get_cache_hit_rate() == 0.0
    assert get_error_rate() == 0.0
    assert get_inference_latency() == 0.0

@pytest.mark.asyncio
async def test_prometheus_server_lifecycle():
    """Test prometheus server lifecycle management"""
    from tradingbot.shared.monitor.prometheus import start_prometheus_server, stop_prometheus_server

    # Test basic server lifecycle
    start_prometheus_server()  # Should not raise
    stop_prometheus_server()   # Should not raise

@pytest.mark.asyncio
async def test_prometheus_server_error_handling():
    """Test prometheus server error handling"""
    from tradingbot.shared.monitor.prometheus import start_prometheus_server, stop_prometheus_server

    # Test that mock functions don't raise exceptions
    start_prometheus_server()  # Should not raise
    stop_prometheus_server()   # Should not raise

@pytest.mark.asyncio
async def test_prometheus_server_concurrent_operations():
    """Test prometheus server concurrent operations"""
    import asyncio
    from tradingbot.shared.monitor.prometheus import start_prometheus_server, stop_prometheus_server

    async def start_stop_server():
        start_prometheus_server()
        await asyncio.sleep(0.1)  # Simulate some work
        stop_prometheus_server()

    # Run multiple concurrent operations
    tasks = [start_stop_server() for _ in range(5)]
    await asyncio.gather(*tasks)  # Should not raise

@pytest.mark.asyncio
async def test_prometheus_server_state_transitions():
    """Test prometheus server state transitions"""
    from tradingbot.shared.monitor.prometheus import start_prometheus_server, stop_prometheus_server

    # Test multiple start/stop cycles
    for _ in range(3):
        start_prometheus_server()  # Should not raise
        stop_prometheus_server()   # Should not raise

@pytest.mark.asyncio
async def test_base_agent_request_validation():
    """Test request validation in process_request method"""
    agent = TestAgent({
        "name": "test",
        "type": "base",
        "enabled": True,
        "parameters": {}
    })
    
    invalid_requests = [
        None,                    # None
        42,                      # Integer
        "string",                # String
        [],                      # List
        set(),                   # Set
        {"wrong_key": "value"},  # Missing cache_key
        {"cache_key": None},     # None cache_key
        {"cache_key": ""},       # Empty cache_key
        {"cache_key": " "},      # Whitespace cache_key
    ]
    
    for req in invalid_requests:
        with pytest.raises((TypeError, ValueError)) as exc_info:
            await agent._process_request(req)
        assert any(msg in str(exc_info.value) for msg in [
            "Request must be a dictionary",
            "cache_key is required"
        ])

@pytest.mark.asyncio
async def test_base_agent_cache_operations_advanced():
    """Test advanced cache operations"""
    agent = TestAgent({
        "name": "test",
        "type": "base",
        "enabled": True,
        "parameters": {}
    })
    
    test_data = [
        ("key1", "simple string"),
        ("key2", {"nested": {"data": 42}}),
        ("key3", [1, 2, {"mixed": "types"}]),
        ("key4", None),
        ("key5", ""),
        ("key6", b"binary data"),
        ("key7", 12345),
        ("key8", 3.14159),
        ("key9", True),
    ]
    
    # Test setting and getting each type
    for key, value in test_data:
        agent.cache.set(key, value)
        assert agent.cache.get(key) == value
        
        # Test cache hit tracking
        result = await agent._process_request({"cache_key": key})
        if value is None:
            assert result == {}
        else:
            assert result == value
        
    # Test cache miss tracking
    result = await agent._process_request({"cache_key": "nonexistent"})
    assert result == {}

    # Test cache clearing
    agent.cache.clear()
    for key, _ in test_data:
        assert agent.cache.get(key) is None

@pytest.mark.asyncio
async def test_base_agent_metrics_detailed():
    """Test detailed metrics tracking"""
    agent = TestAgent({
        "name": "test",
        "type": "base",
        "enabled": True,
        "parameters": {}
    })
    
    # Reset metrics
    reset_metrics()
    
    # Simulate mixed cache hits and misses
    cache_scenarios = [
        ("hit1", "data1", True),   # Hit
        ("hit2", "data2", True),   # Hit
        ("miss1", None, False),    # Miss
        ("error1", Exception("Test error"), None),  # Error
    ]
    
    for key, value, expected_hit in cache_scenarios:
        if isinstance(value, Exception):
            with patch.object(agent.cache, 'get', side_effect=value):
    with pytest.raises(Exception):
                    await agent._process_request({"cache_key": key})
        else:
            with patch.object(agent.cache, 'get', return_value=value):
                result = await agent._process_request({"cache_key": key})
                if expected_hit:
                    assert result == value
                else:
                    assert result == {}
    
    # Verify metrics
    status = agent.get_status()
    metrics = status["metrics"]
    
    assert 0 <= metrics["cache_hit_rate"] <= 1
    assert 0 <= metrics["error_rate"] <= 1
    assert metrics["inference_latency"] >= 0

@pytest.mark.asyncio
async def test_base_agent_concurrent_cache_access():
    """Test concurrent cache access"""
    import asyncio
    
    agent = TestAgent({
        "name": "test",
        "type": "base",
        "enabled": True,
        "parameters": {}
    })
    
    async def cache_operation(key: str, value: Any = None):
        if value is not None:
            agent.cache.set(key, value)
        return await agent._process_request({"cache_key": key})
    
    # Create multiple concurrent operations
    operations = [
        cache_operation("key1", "value1"),
        cache_operation("key2", "value2"),
        cache_operation("key1"),  # Read existing
        cache_operation("key3"),  # Read non-existent
        cache_operation("key2"),  # Read existing
    ]
    
    # Execute operations concurrently
    results = await asyncio.gather(*operations)
    
    # Verify results
    assert results[0] == "value1"  # First write then read
    assert results[1] == "value2"  # First write then read
    assert results[2] == "value1"  # Read existing
    assert results[3] == {}        # Read non-existent
    assert results[4] == "value2"  # Read existing
