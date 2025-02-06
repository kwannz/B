import aiohttp
import logging
import asyncio
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class SolscanClient:
    def __init__(self, config: Dict[str, Any]) -> None:
        self.api_key = config.get("api_key")
        self.base_url = "https://pro-api.solscan.io/v2.0"
        self.session: Optional[aiohttp.ClientSession] = None
        self.headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.api_key}",
            "User-Agent": "TradingBot/1.0",
            "Content-Type": "application/json"
        }
        self.retry_count = config.get("retry_count", 3)
        self.retry_delay = config.get("retry_delay", 1000)
        self.rate_limit = config.get("rate_limit", 1000)  # 1000 requests per 60s
        self._request_count = 0
        self._request_reset_time = 0.0
        
    async def _handle_rate_limit(self) -> None:
        current_time = asyncio.get_event_loop().time()
        if current_time > self._request_reset_time:
            self._request_count = 0
            self._request_reset_time = current_time + 60
        
        if self._request_count >= self.rate_limit:
            wait_time = self._request_reset_time - current_time
            if wait_time > 0:
                await asyncio.sleep(wait_time)
                self._request_count = 0
                self._request_reset_time = current_time + 60

    async def _make_request(self, endpoint: str, params: Dict[str, Any]) -> Dict[str, Any]:
        if not self.session:
            return {"error": "Client not initialized"}

        await self._handle_rate_limit()
        
        for attempt in range(self.retry_count):
            try:
                self._request_count += 1
                async with self.session.get(f"{self.base_url}/{endpoint}", params=params) as response:
                    if response.status == 200:
                        return await response.json()
                    if response.status == 429:  # Rate limit
                        self._request_count = self.rate_limit
                        continue
                    logger.error(f"Request failed: {response.status}")
                    return {"error": f"Request failed with status {response.status}"}
            except Exception as e:
                logger.error(f"Request error: {str(e)}")
                if attempt < self.retry_count - 1:
                    await asyncio.sleep(self.retry_delay * (2 ** attempt) / 1000)
                    continue
                return {"error": str(e)}
        return {"error": "Max retries exceeded"}

    async def start(self) -> None:
        if not self.session:
            self.session = aiohttp.ClientSession(headers=self.headers)
            self._request_count = 0
            self._request_reset_time = asyncio.get_event_loop().time() + 60
            
    async def stop(self) -> None:
        if self.session:
            await self.session.close()
            self.session = None
            
    async def get_token_info(self, token_address: str) -> Dict[str, Any]:
        return await self._make_request("token/meta", {"token": token_address})

    async def get_token_holders(self, token_address: str, limit: int = 10, offset: int = 0) -> Dict[str, Any]:
        params = {
            "token": token_address,
            "limit": limit,
            "offset": offset
        }
        return await self._make_request("token/holders", params)

    async def get_market_info(self, token_address: str) -> Dict[str, Any]:
        return await self._make_request("token/markets", {"token": token_address})

    async def get_transaction_info(self, signature: str) -> Dict[str, Any]:
        return await self._make_request("transaction/details", {"tx": signature})

    async def get_account_transactions(self, address: str, limit: int = 10) -> Dict[str, Any]:
        params = {
            "account": address,
            "limit": limit
        }
        return await self._make_request("account/transactions", params)
