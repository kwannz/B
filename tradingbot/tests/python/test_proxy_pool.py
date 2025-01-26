"""
Test proxy pool implementation
"""

import os
import pytest
import asyncio
from unittest.mock import AsyncMock, Mock, patch
import aiohttp
from tradingbot.shared.proxy_pool import ProxyPool, Proxy


@pytest.fixture
def proxy_pool():
    """Create proxy pool instance"""
    with patch.dict(
        os.environ,
        {
            "PROXY_LIST": "http://proxy1.test:8080;http://proxy2.test:8080",
            "PROXY_USERNAME": "user",
            "PROXY_PASSWORD": "pass",
        },
    ):
        pool = ProxyPool(rotation_interval=1)
        return pool


@pytest.mark.asyncio
async def test_proxy_rotation(proxy_pool):
    """Test proxy rotation"""
    # Get initial proxy
    proxy1 = proxy_pool.get_proxy()
    assert proxy1 is not None

    # Should get same proxy within rotation interval
    proxy2 = proxy_pool.get_proxy()
    assert proxy2.url == proxy1.url

    # Wait for rotation
    await asyncio.sleep(1.1)

    # Should get different proxy
    proxy3 = proxy_pool.get_proxy()
    assert proxy3.url != proxy1.url


@pytest.mark.asyncio
async def test_proxy_health_check(proxy_pool):
    """Test proxy health checking"""
    with patch("aiohttp.ClientSession") as mock_session:
        # Mock successful response
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_session.return_value.__aenter__.return_value.get.return_value.__aenter__.return_value = (
            mock_response
        )

        await proxy_pool.check_proxies()

        # All proxies should be active
        assert all(p.is_active for p in proxy_pool.proxies)
        assert all(p.fail_count == 0 for p in proxy_pool.proxies)


@pytest.mark.asyncio
async def test_proxy_failure_handling(proxy_pool):
    """Test proxy failure handling"""
    proxy = proxy_pool.get_proxy()

    # Mark failures
    for _ in range(proxy_pool.max_fails - 1):
        proxy_pool.mark_failed(proxy)
        assert proxy.is_active

    # Final failure should deactivate
    proxy_pool.mark_failed(proxy)
    assert not proxy.is_active

    # Success should reset
    proxy_pool.mark_success(proxy)
    assert proxy.fail_count == 0


@pytest.mark.asyncio
async def test_aiohttp_proxy_config(proxy_pool):
    """Test aiohttp proxy configuration"""
    proxy = proxy_pool.get_proxy()
    config = proxy_pool.get_aiohttp_proxy(proxy)

    assert config["proxy"] == proxy.url
    assert isinstance(config["proxy_auth"], aiohttp.BasicAuth)
    assert config["proxy_auth"].login == "user"
    assert config["proxy_auth"].password == "pass"


if __name__ == "__main__":
    pytest.main(["-v", __file__])
