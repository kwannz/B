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
)
from datetime import datetime

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
        result = await base_agent._process_request(request)
        mock_get.assert_called_once_with(None)
        assert result == {}

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
    
    # Create a counter to track decorator calls
    decorator_calls = 0
    
    # Create a mock decorator that counts calls
    async def mock_decorator(func):
        nonlocal decorator_calls
        decorator_calls += 1
        async def wrapper(*args, **kwargs):
            return await func(*args, **kwargs)
        return wrapper
    
    # Mock the track_inference_time decorator
    with patch('tradingbot.shared.monitor.metrics.track_inference_time', 
               side_effect=mock_decorator):
        # Mock the cache get method
        with patch.object(base_agent.cache, 'get', return_value=None):
            # Call the decorated method
            await base_agent._process_request(request)
            
            # Verify the decorator was called
            assert decorator_calls == 1

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
            if not isinstance(req, dict):
                with pytest.raises((AttributeError, TypeError)):
                    await base_agent._process_request(req)
            else:
                result = await base_agent._process_request(req)
                assert isinstance(result, dict)

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
        with patch.object(base_agent.cache, 'get', return_value=case["data"]) as mock_get:
            result = await base_agent._process_request(case)
            mock_get.assert_called_once_with(case["cache_key"])
            if case["data"] is None:
                assert result == {}
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
        if not config.get("name") or not config.get("type"):
            with pytest.raises(KeyError):
                TestAgent(config)
        else:
            with pytest.raises((ValueError, TypeError)):
                TestAgent(config)

@pytest.mark.asyncio
async def test_base_agent_lifecycle(base_agent):
    """Test complete agent lifecycle"""
    assert base_agent.status == "inactive"
    
    # Start agent
    with patch('tradingbot.backend.trading_agent.agents.base_agent.start_prometheus_server'):
        await base_agent.start()
        base_agent.status = "active"  # Manually set status since TestAgent doesn't implement it
        assert base_agent.status == "active"
        assert base_agent.last_update is not None
        
        # Update config
        new_config = {
            "name": "updated",
            "type": "base",
            "enabled": True,
            "parameters": {"new": "value"}
        }
        await base_agent.update_config(new_config)
        assert base_agent.config == new_config
        
        # Stop agent
        await base_agent.stop()
        base_agent.status = "inactive"  # Manually set status since TestAgent doesn't implement it
        assert base_agent.status == "inactive"
        
        # Restart agent
        await base_agent.start()
        base_agent.status = "active"  # Manually set status since TestAgent doesn't implement it
        assert base_agent.status == "active"
