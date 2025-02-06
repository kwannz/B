import aiohttp
import asyncio
import logging
import time
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class JupiterClient:
    def __init__(self, config: Dict[str, Any]):
        self.base_url = "https://quote-api.jup.ag/v6"
        self.slippage_bps = config.get("slippage_bps", 200)  # 2% default
        self.retry_count = config.get("retry_count", 3)
        self.retry_delay = config.get("retry_delay", 1000)  # 1s initial delay
        self.circuit_breaker_failures = 0
        self.circuit_breaker_cooldown = 600  # 10 minutes
        self.last_failure_time = 0
        self.last_request_time = 0
        self.rate_limit_delay = 1.0  # 1 second between requests (1 RPS)
        self.session: Optional[aiohttp.ClientSession] = None
        
    async def start(self) -> bool:
        try:
            if not self.session:
                self.session = aiohttp.ClientSession()
            return True
        except Exception as e:
            logger.error(f"Failed to initialize Jupiter client: {e}")
            return False
    async def stop(self):
        if self.session:
            await self.session.close()
            self.session = None
            
    async def execute_swap(self, params: Dict[str, Any]) -> Dict[str, Any]:
        if not self.session:
            return {"error": "Client not initialized"}
            
        if self.circuit_breaker_failures >= 5:
            current_time = time.time()
            if current_time - self.last_failure_time < self.circuit_breaker_cooldown:
                return {"error": "Circuit breaker active"}
            self.circuit_breaker_failures = 0
            
        await self._enforce_rate_limit()
        current_delay = self.retry_delay
        
        for attempt in range(self.retry_count):
            try:
                # Get swap instructions
                async with self.session.post(f"{self.base_url}/swap", json=params) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        logger.error(f"Swap failed with status {response.status}: {error_text}")
                        raise RuntimeError(f"Swap failed: {error_text}")
                        
                    swap_data = await response.json()
                    if "error" in swap_data:
                        raise RuntimeError(f"Swap error: {swap_data['error']}")
                        
                    # Execute swap transaction
                    async with self.session.post(f"{self.base_url}/execute", json={
                        "swapTransaction": swap_data["swapTransaction"],
                        "walletAddress": params["walletAddress"],
                        "prioritizationFeeLamports": "auto"
                    }) as exec_response:
                        if exec_response.status != 200:
                            error_text = await exec_response.text()
                            logger.error(f"Execute failed with status {exec_response.status}: {error_text}")
                            raise RuntimeError(f"Execute failed: {error_text}")
                            
                        result = await exec_response.json()
                        if "error" in result:
                            raise RuntimeError(f"Execute error: {result['error']}")
                            
                        self.circuit_breaker_failures = 0
                        return result
                        
            except Exception as e:
                logger.error(f"Swap attempt {attempt + 1} failed: {e}")
                if attempt < self.retry_count - 1:
                    await asyncio.sleep(current_delay / 1000)
                    current_delay *= 1.5
                    continue
                self.circuit_breaker_failures += 1
                self.last_failure_time = time.time()
                return {"error": str(e)}
                
        self.circuit_breaker_failures += 1
        self.last_failure_time = time.time()
        return {"error": "All retry attempts failed"}
            
    async def _enforce_rate_limit(self):
        current_time = time.time()
        time_since_last = current_time - self.last_request_time
        if time_since_last < self.rate_limit_delay:
            await asyncio.sleep(self.rate_limit_delay - time_since_last)
        self.last_request_time = time.time()
            
    async def get_quote(self, input_mint: str, output_mint: str, amount: int) -> Dict[str, Any]:
        if not self.session:
            return {"error": "Client not initialized"}
            
        if self.circuit_breaker_failures >= 5:
            current_time = time.time()
            if current_time - self.last_failure_time < self.circuit_breaker_cooldown:
                return {"error": "Circuit breaker active"}
            self.circuit_breaker_failures = 0
            
        await self._enforce_rate_limit()
        current_delay = self.retry_delay
        
        for attempt in range(self.retry_count):
            try:
                params = {
                    "inputMint": input_mint,
                    "outputMint": output_mint,
                    "amount": str(amount),
                    "slippageBps": self.slippage_bps,
                    "onlyDirectRoutes": True,
                    "asLegacyTransaction": True,
                    "maxAccounts": 54,
                    "platformFeeBps": 0
                }
                async with self.session.get(f"{self.base_url}/quote", params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        self.circuit_breaker_failures = 0
                        return data
                    elif response.status == 429:  # Rate limit exceeded
                        logger.warning("Rate limit exceeded, increasing delay")
                        self.rate_limit_delay = min(self.rate_limit_delay * 1.5, 5.0)
                        
                self.circuit_breaker_failures += 1
                if attempt < self.retry_count - 1:
                    await asyncio.sleep(current_delay / 1000)
                    current_delay = min(current_delay * 1.5, 5000)  # Max 5s delay
                    continue
                    
                self.last_failure_time = time.time()
                return {"error": f"Failed to get quote: {response.status}"}
            except Exception as e:
                logger.error(f"Jupiter API error: {e}")
                self.circuit_breaker_failures += 1
                if attempt < self.retry_count - 1:
                    await asyncio.sleep(current_delay / 1000)
                    current_delay = min(current_delay * 1.5, 5000)
                    continue
                self.last_failure_time = time.time()
                return {"error": str(e)}
        return {"error": "Failed to get quote after all retries"}
