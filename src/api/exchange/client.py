"""
Exchange client interface
"""

from typing import Optional, List, Dict, Any
from decimal import Decimal
from datetime import datetime
import logging
import hmac
import hashlib
import time
import json
import aiohttp
from urllib.parse import urlencode

logger = logging.getLogger(__name__)


class ExchangeClient:
    """Generic exchange client interface."""

    def __init__(
        self,
        api_key: str,
        api_secret: str,
        testnet: bool = False,
        recv_window: int = 5000,
    ):
        """Initialize exchange client."""
        self.api_key = api_key
        self.api_secret = api_secret.encode()
        self.testnet = testnet
        self.recv_window = recv_window
        self.base_url = (
            "https://testnet.binance.com/api"
            if testnet
            else "https://api.binance.com/api"
        )
        self.session = None

    async def __aenter__(self):
        """Enter async context."""
        await self.init()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Exit async context."""
        await self.close()

    async def init(self):
        """Initialize HTTP session."""
        self.session = aiohttp.ClientSession()

    async def close(self):
        """Close HTTP session."""
        if self.session:
            await self.session.close()
            self.session = None

    def _get_timestamp(self) -> int:
        """Get current timestamp in milliseconds."""
        return int(time.time() * 1000)

    def _generate_signature(self, query_string: str) -> str:
        """Generate HMAC SHA256 signature."""
        return hmac.new(
            self.api_secret, query_string.encode(), hashlib.sha256
        ).hexdigest()

    async def _request(
        self, method: str, endpoint: str, signed: bool = False, **kwargs
    ) -> Dict[str, Any]:
        """Make HTTP request to exchange API."""
        if not self.session:
            await self.init()

        # Prepare request parameters
        kwargs["headers"] = kwargs.get("headers", {})
        kwargs["headers"]["X-MBX-APIKEY"] = self.api_key

        if signed:
            # Add timestamp and receive window
            params = kwargs.get("params", {})
            params["timestamp"] = self._get_timestamp()
            params["recvWindow"] = self.recv_window

            # Generate signature
            query_string = urlencode(params)
            params["signature"] = self._generate_signature(query_string)
            kwargs["params"] = params

        # Make request
        url = f"{self.base_url}{endpoint}"
        try:
            async with self.session.request(method, url, **kwargs) as response:
                if response.status == 429:
                    retry_after = int(response.headers.get("Retry-After", 0))
                    logger.warning(f"Rate limit exceeded. Retry after {retry_after}s")
                    raise Exception("Rate limit exceeded")

                data = await response.json()

                if response.status >= 400:
                    logger.error(f"Exchange API error: {data}")
                    raise Exception(f"Exchange API error: {data}")

                return data
        except Exception as e:
            logger.error(f"Request failed: {str(e)}")
            raise

    # Market Data Methods
    async def get_exchange_info(self) -> Dict[str, Any]:
        """Get exchange trading rules and symbol information."""
        return await self._request("GET", "/v3/exchangeInfo")

    async def get_symbols(self) -> List[str]:
        """Get list of trading symbols."""
        info = await self.get_exchange_info()
        return [symbol["symbol"] for symbol in info["symbols"]]

    async def get_ticker(self, symbol: str) -> Dict[str, Any]:
        """Get ticker information."""
        return await self._request("GET", "/v3/ticker/24hr", params={"symbol": symbol})

    async def get_orderbook(self, symbol: str, limit: int = 100) -> Dict[str, Any]:
        """Get order book."""
        return await self._request(
            "GET", "/v3/depth", params={"symbol": symbol, "limit": limit}
        )

    async def get_trades(self, symbol: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Get recent trades."""
        return await self._request(
            "GET", "/v3/trades", params={"symbol": symbol, "limit": limit}
        )

    async def get_klines(
        self,
        symbol: str,
        interval: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 500,
    ) -> List[Dict[str, Any]]:
        """Get candlestick data."""
        params = {"symbol": symbol, "interval": interval, "limit": limit}
        if start_time:
            params["startTime"] = int(start_time.timestamp() * 1000)
        if end_time:
            params["endTime"] = int(end_time.timestamp() * 1000)

        return await self._request("GET", "/v3/klines", params=params)

    async def get_24h_stats(self, symbol: str) -> Dict[str, Any]:
        """Get 24-hour price change statistics."""
        return await self._request("GET", "/v3/ticker/24hr", params={"symbol": symbol})

    # Trading Methods
    async def create_order(
        self,
        symbol: str,
        side: str,
        order_type: str,
        quantity: Decimal,
        price: Optional[Decimal] = None,
        stop_price: Optional[Decimal] = None,
        time_in_force: str = "GTC",
        **kwargs,
    ) -> Dict[str, Any]:
        """Create a new order."""
        params = {
            "symbol": symbol,
            "side": side.upper(),
            "type": order_type.upper(),
            "quantity": str(quantity),
            "timestamp": self._get_timestamp(),
        }

        if price:
            params["price"] = str(price)
        if stop_price:
            params["stopPrice"] = str(stop_price)
        if time_in_force:
            params["timeInForce"] = time_in_force

        params.update(kwargs)

        return await self._request("POST", "/v3/order", signed=True, params=params)

    async def create_market_order(
        self, symbol: str, side: str, amount: Decimal
    ) -> Dict[str, Any]:
        """Create market order."""
        return await self.create_order(
            symbol=symbol, side=side, order_type="MARKET", quantity=amount
        )

    async def create_limit_order(
        self, symbol: str, side: str, amount: Decimal, price: Decimal
    ) -> Dict[str, Any]:
        """Create limit order."""
        return await self.create_order(
            symbol=symbol,
            side=side,
            order_type="LIMIT",
            quantity=amount,
            price=price,
            time_in_force="GTC",
        )

    async def create_stop_order(
        self,
        symbol: str,
        side: str,
        amount: Decimal,
        stop_price: Decimal,
        limit_price: Optional[Decimal] = None,
    ) -> Dict[str, Any]:
        """Create stop/stop-limit order."""
        if limit_price:
            return await self.create_order(
                symbol=symbol,
                side=side,
                order_type="STOP_LOSS_LIMIT",
                quantity=amount,
                price=limit_price,
                stop_price=stop_price,
                time_in_force="GTC",
            )
        else:
            return await self.create_order(
                symbol=symbol,
                side=side,
                order_type="STOP_LOSS",
                quantity=amount,
                stop_price=stop_price,
            )

    async def cancel_order(self, symbol: str, order_id: str) -> Dict[str, Any]:
        """Cancel an order."""
        return await self._request(
            "DELETE",
            "/v3/order",
            signed=True,
            params={"symbol": symbol, "orderId": order_id},
        )

    async def get_order(self, symbol: str, order_id: str) -> Dict[str, Any]:
        """Get order status."""
        return await self._request(
            "GET",
            "/v3/order",
            signed=True,
            params={"symbol": symbol, "orderId": order_id},
        )

    async def get_open_orders(
        self, symbol: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get open orders."""
        params = {}
        if symbol:
            params["symbol"] = symbol

        return await self._request("GET", "/v3/openOrders", signed=True, params=params)

    async def get_account(self) -> Dict[str, Any]:
        """Get account information."""
        return await self._request("GET", "/v3/account", signed=True)
