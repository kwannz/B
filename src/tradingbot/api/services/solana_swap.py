from typing import Dict, Optional
import asyncio
import aiohttp
from decimal import Decimal
import logging
import time

from ..core.config import settings
from ..models.trading import OrderSide, OrderType, TradeStatus
from ..monitoring.metrics import record_swap

logger = logging.getLogger(__name__)

class SolanaSwapService:
    def __init__(self):
        self.jupiter_url = settings.dex_settings["jupiter_api_url"]
        self.wallet_key = settings.wallet_key
        self._session: Optional[aiohttp.ClientSession] = None
        
    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=settings.api_timeout)
            )
        return self._session

    async def get_swap_quote(
        self,
        input_mint: str,
        output_mint: str,
        amount: Decimal,
        slippage_bps: int = 50
    ) -> Dict:
        try:
            session = await self._get_session()
            params = {
                "inputMint": input_mint,
                "outputMint": output_mint,
                "amount": str(int(amount * Decimal("1e9"))),
                "slippageBps": slippage_bps,
                "onlyDirectRoutes": "true"
            }
            
            async with session.get(f"{self.jupiter_url}/quote", params=params) as response:
                if response.status != 200:
                    error_text = await response.text()
                    logger.error(f"Quote error: {error_text}")
                    return {"success": False, "error": f"Quote failed: {error_text}"}
                    
                quote = await response.json()
                return {"success": True, "data": quote}
        except Exception as e:
            logger.error(f"Error getting swap quote: {e}")
            return {"success": False, "error": str(e)}

    async def execute_swap(self, quote_response: Dict) -> Dict:
        start_time = time.time()
        market = quote_response.get("data", {}).get("inputMint", "unknown")
        try:
            if not quote_response.get("data"):
                return {"success": False, "error": "Invalid quote data"}
                
            session = await self._get_session()
            headers = {"Authorization": f"Wallet {self.wallet_key}"}
            
            async with session.post(
                f"{self.jupiter_url}/swap",
                json=quote_response["data"],
                headers=headers
            ) as response:
                duration = time.time() - start_time
                if response.status != 200:
                    error_text = await response.text()
                    logger.error(f"Swap error: {error_text}")
                    record_swap(
                        market=market,
                        status=TradeStatus.FAILED.value,
                        volume=0.0,
                        latency=duration,
                        slippage=0.0,
                        risk_level=0.0,
                        liquidity={}
                    )
                    return {
                        "success": False,
                        "error": f"Swap failed: {error_text}",
                        "status": TradeStatus.FAILED
                    }
                    
                result = await response.json()
                volume = float(quote_response["data"].get("amount", 0))
                slippage = float(quote_response["data"].get("slippageBps", 0)) / 10000
                risk_level = float(quote_response["data"].get("riskLevel", 0.5))
                liquidity = {
                    "jupiter": float(quote_response["data"].get("liquidity", 0))
                }
                
                record_swap(
                    market=market,
                    status=TradeStatus.EXECUTED.value,
                    volume=volume,
                    latency=duration,
                    slippage=slippage,
                    risk_level=risk_level,
                    liquidity=liquidity
                )
                
                return {
                    "success": True,
                    "data": result,
                    "status": TradeStatus.EXECUTED,
                    "transaction_id": result.get("txid"),
                    "execution_time": duration,
                    "slippage": slippage
                }
        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"Error executing swap: {e}")
            record_swap(
                market=market,
                status=TradeStatus.FAILED.value,
                volume=0.0,
                latency=duration,
                slippage=0.0,
                risk_level=0.0,
                liquidity={}
            )
            return {
                "success": False,
                "error": str(e),
                "status": TradeStatus.FAILED
            }

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()

solana_swap_service = SolanaSwapService()
