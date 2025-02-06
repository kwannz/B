from typing import Dict, Optional
import asyncio
import aiohttp
from decimal import Decimal
import json
import logging
import time

from ..core.config import settings
from ..models.trading import OrderSide, OrderType, TradeStatus
from ..monitoring.metrics import record_swap

logger = logging.getLogger(__name__)

class OrcaSwapService:
    def __init__(self):
        self.orca_url = "https://api.orca.so/v2"
        self.wallet_key = settings.SOLANA_WALLET_KEY
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
            amount_base = str(int(amount))
            
            params = {
                "fromToken": input_mint,
                "toToken": output_mint,
                "amount": amount_base,
                "slippage": str(slippage_bps / 10000),
                "onlyDirectRoutes": "false"
            }
            
            async with session.get(f"{self.orca_url}/quote", params=params) as response:
                if response.status != 200:
                    error_text = await response.text()
                    return {"success": False, "error": f"Quote failed: {error_text}"}
                
                quote_data = await response.json()
                if "error" in quote_data:
                    return {"success": False, "error": quote_data["error"]}
                    
                return {"success": True, "data": quote_data}
        except Exception as e:
            logger.error(f"Error getting Orca swap quote: {e}")
            return {"success": False, "error": str(e)}

    async def execute_swap(self, quote_response: Dict) -> Dict:
        start_time = time.time()
        market = quote_response.get("data", {}).get("fromToken", "unknown")
        try:
            if not quote_response.get("data"):
                return {"success": False, "error": "Invalid quote data"}
                
            session = await self._get_session()
            swap_endpoint = f"{self.orca_url}/swap"
            
            swap_request = {
                "owner": self.wallet_key,
                "quote": quote_response["data"],
                "userPublicKey": self.wallet_key
            }
            
            async with session.post(
                swap_endpoint,
                json=swap_request,
                headers={"Content-Type": "application/json"}
            ) as swap_response:
                if swap_response.status != 200:
                    error_text = await swap_response.text()
                    raise ValueError(f"Failed to execute swap: {error_text}")
                
                swap_result = await swap_response.json()
                
                quote_data = quote_response["data"]
                volume = Decimal(str(quote_data.get("inAmount", 0)))
                slippage = Decimal("50") / Decimal("10000")
                risk_level = Decimal("0.5")
                liquidity = {"orca": Decimal(str(quote_data.get("outAmount", 0)))}
                
                record_swap(
                    market=market,
                    status=TradeStatus.EXECUTED.value,
                    volume=volume,
                    latency=time.time() - start_time,
                    slippage=slippage,
                    risk_level=risk_level,
                    liquidity=liquidity
                )
                
                return {
                    "success": True,
                    "status": TradeStatus.EXECUTED,
                    "transaction_id": swap_result.get("txId"),
                    "execution_time": time.time() - start_time,
                    "slippage": float(slippage)
                }
                
        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"Error executing Orca swap: {e}")
            record_swap(
                market=market,
                status=TradeStatus.FAILED.value,
                volume=Decimal("0"),
                latency=duration,
                slippage=Decimal("0"),
                risk_level=Decimal("0"),
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

orca_swap_service = OrcaSwapService()
