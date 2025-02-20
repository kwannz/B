import json
from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional, cast

import aiohttp
from .gmgn_client import GMGNClient


class TradeType(str, Enum):
    """Trade type enumeration."""
    BUY = "buy"
    SELL = "sell"


class DEXClient:
    """Client for interacting with multiple DEX APIs."""

    def __init__(self):
        self.session = None
        self.base_urls = {
            "uniswap": "https://api.uniswap.org/v1",
            "jupiter": "https://quote-api.jup.ag/v6",
            "raydium": "https://api.raydium.io/v2",
            "pancakeswap": "https://api.pancakeswap.info/api/v2",
            "liquidswap": "https://api.liquidswap.com",
            "hyperliquid": "https://api.hyperliquid.xyz",
            "gmgn": "https://gmgn.ai/defi/router/v1/sol"
        }
        self.jupiter_client = None
        self.gmgn_client = None

    async def start(self):
        """Initialize HTTP session."""
        self.session = aiohttp.ClientSession()

    async def stop(self):
        """Close HTTP session."""
        if self.session:
            await self.session.close()
            self.session = None
        if self.jupiter_client:
            await self.jupiter_client.stop()
            self.jupiter_client = None
        if self.gmgn_client:
            await cast(GMGNClient, self.gmgn_client).stop()
            self.gmgn_client = None

    async def get_quote(
        self, dex: str, token_in: str, token_out: str, amount: float
    ) -> Dict[str, Any]:
        """Get quote from specified DEX."""
        if dex == "gmgn":
            if not self.gmgn_client:
                from .gmgn_client import GMGNClient
                self.gmgn_client = GMGNClient({
                    "slippage": 0.5,
                    "fee": 0.002,
                    "use_anti_mev": True,
                    "wallet_address": None  # Will be set during swap execution
                })
                await self.gmgn_client.start()
            return await self.gmgn_client.get_quote(
                token_in, token_out, float(amount)
            )
        elif dex == "jupiter":
            if not self.jupiter_client:
                from .jupiter_client import JupiterClient

                self.jupiter_client = JupiterClient({"slippage_bps": 100})
                await self.jupiter_client.start()
            return await self.jupiter_client.get_quote(
                token_in, token_out, int(amount * 1e9)
            )

        if not self.session:
            await self.start()
            if not self.session:
                return {"error": "Failed to initialize session"}

        endpoints = {
            "uniswap": "/quote",
            "jupiter": "/quote",
            "raydium": "/quote",
            "pancakeswap": "/pairs",
            "liquidswap": "/quote",
            "hyperliquid": "/quote",
        }

        params = {"tokenIn": token_in, "tokenOut": token_out, "amount": str(amount)}

        try:
            async with self.session.get(
                f"{self.base_urls[dex]}{endpoints[dex]}", params=params
            ) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    return {
                        "error": f"Failed to get quote from {dex}",
                        "status": response.status,
                        "message": await response.text(),
                    }
        except Exception as e:
            return {"error": str(e)}

    async def get_liquidity(self, dex: str, token: str, quote_token: str) -> Dict[str, Any]:
        """Get liquidity information for a token pair."""
        if not self.session:
            await self.start()
            if not self.session:
                return {"error": "Failed to initialize session"}

        endpoints = {
            "uniswap": "/pools",
            "jupiter": "/market-depth",
            "raydium": "/pools",
            "pancakeswap": "/tokens",
            "liquidswap": "/pools",
            "hyperliquid": "/pools",
        }

        try:
            async with self.session.get(
                f"{self.base_urls[dex]}{endpoints[dex]}", params={"token": token}
            ) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    return {
                        "error": f"Failed to get liquidity from {dex}",
                        "status": response.status,
                        "message": await response.text(),
                    }
        except Exception as e:
            return {"error": str(e)}

    async def execute_swap(
        self, dex: str, quote: Dict[str, Any], wallet: Any, config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Execute swap on specified DEX."""
        if dex == "gmgn":
            if not self.gmgn_client:
                from .gmgn_client import GMGNClient
                self.gmgn_client = GMGNClient(config or {
                    "slippage": 0.5,
                    "fee": 0.002,
                    "use_anti_mev": True
                })
                await self.gmgn_client.start()
            try:
                if not quote or "data" not in quote or "raw_tx" not in quote["data"]:
                    return {"error": "Invalid quote response"}
                return await self.gmgn_client.execute_swap(quote, wallet)
            except Exception as e:
                return {"error": f"Failed to execute swap: {str(e)}"}
        else:
            return {"error": f"Unsupported DEX: {dex}"}

    async def get_market_data(self, dex: str) -> Dict[str, Any]:
        """Get market data from DEX."""
        if dex == "gmgn":
            if not self.gmgn_client:
                from .gmgn_client import GMGNClient
                self.gmgn_client = GMGNClient({
                    "slippage": 0.5,
                    "fee": 0.002,
                    "use_anti_mev": True
                })
                await self.gmgn_client.start()
            return await self.gmgn_client.get_market_data()

        if not self.session:
            await self.start()
            if not self.session:
                return {"error": "Failed to initialize session"}

        try:
            if dex == "gmgn":
                if not self.gmgn_client:
                    from .gmgn_client import GMGNClient
                    self.gmgn_client = GMGNClient({
                        "slippage": 0.5,
                        "fee": 0.002,
                        "use_anti_mev": True
                    })
                    await self.gmgn_client.start()
                try:
                    return await self.gmgn_client.get_market_data()
                except Exception as e:
                    return {"error": str(e)}

            if dex not in self.base_urls:
                return {"error": f"Unsupported DEX: {dex}"}

            async with self.session.get(
                f"{self.base_urls[dex]}/market"
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return {
                        "code": 0,
                        "msg": "success",
                        "data": data
                    }
                else:
                    error_msg = await response.text()
                    return {
                        "error": f"Failed to get market data from {dex}: {error_msg}",
                        "status": response.status
                    }
        except Exception as e:
            return {"error": str(e)}
