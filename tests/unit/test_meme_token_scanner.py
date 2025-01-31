import pytest
from datetime import datetime
from unittest.mock import AsyncMock, patch
from src.shared.scanner.meme_token_scanner import MemeTokenScanner
from src.shared.models.market_data import MarketData

@pytest.fixture
def scanner_config():
    return {
        'max_market_cap': 30000,
        'min_volume': 1000
    }

@pytest.fixture
def mock_token_list():
    return [
        {
            "id": "test-token-1",
            "symbol": "test1",
            "name": "Test Token 1",
            "platforms": {
                "solana": "So1ana111111111111111111111111111111111111"
            }
        },
        {
            "id": "test-token-2",
            "symbol": "test2",
            "name": "Test Token 2",
            "platforms": {
                "ethereum": "0x123"
            }
        }
    ]

@pytest.fixture
def mock_market_data():
    return {
        "test-token-1": {
            "usd": 0.1,
            "usd_market_cap": 25000,
            "usd_24h_vol": 2000
        }
    }

async def test_scan_for_meme_tokens(scanner_config, mock_token_list, mock_market_data):
    scanner = MemeTokenScanner(scanner_config)
    
    async def mock_get(*args, **kwargs):
        class MockResponse:
            async def json(self):
                if "coins/list" in args[0]:
                    return mock_token_list
                return mock_market_data
            
            @property
            def status(self):
                return 200
                
        return MockResponse()
    
    with patch('aiohttp.ClientSession.get', new=mock_get):
        tokens = await scanner.scan_for_meme_tokens()
        assert len(tokens) == 1
        assert tokens[0]["id"] == "test-token-1"
        assert tokens[0]["market_cap"] == 25000
        assert tokens[0]["volume"] == 2000

async def test_get_token_market_data(scanner_config, mock_market_data):
    scanner = MemeTokenScanner(scanner_config)
    
    async def mock_get(*args, **kwargs):
        class MockResponse:
            async def json(self):
                return mock_market_data
            
            @property
            def status(self):
                return 200
                
        return MockResponse()
    
    with patch('aiohttp.ClientSession.get', new=mock_get):
        market_data = await scanner.get_token_market_data("test-token-1")
        assert isinstance(market_data, MarketData)
        assert market_data.symbol == "test-token-1"
        assert market_data.price == 0.1
        assert market_data.volume == 2000

async def test_scan_for_meme_tokens_api_error(scanner_config):
    scanner = MemeTokenScanner(scanner_config)
    
    async def mock_get(*args, **kwargs):
        class MockResponse:
            @property
            def status(self):
                return 429
                
        return MockResponse()
    
    with patch('aiohttp.ClientSession.get', new=mock_get):
        tokens = await scanner.scan_for_meme_tokens()
        assert len(tokens) == 0

async def test_get_token_market_data_not_found(scanner_config):
    scanner = MemeTokenScanner(scanner_config)
    
    async def mock_get(*args, **kwargs):
        class MockResponse:
            async def json(self):
                return {}
            
            @property
            def status(self):
                return 200
                
        return MockResponse()
    
    with patch('aiohttp.ClientSession.get', new=mock_get):
        market_data = await scanner.get_token_market_data("nonexistent-token")
        assert market_data is None
