import aiohttp
import asyncio
import logging
import os
import time
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class JupiterClient:
    def __init__(self, config: Dict[str, Any]):
        self.base_url = "https://quote-api.jup.ag/v6"
        self.rpc_url = config.get("rpc_url") or os.getenv("HELIUS_RPC_URL")
        self.ws_url = config.get("ws_url") or os.getenv("HELIUS_WS_URL")
        self.slippage_bps = config.get("slippage_bps", 250)  # 2.5% default
        self.retry_count = config.get("retry_count", 3)
        self.retry_delay = config.get("retry_delay", 1000)  # 1s initial delay
        self.circuit_breaker_failures = 0
        self.circuit_breaker_cooldown = 600  # 10 minutes
        self.last_failure_time = 0
        self.last_request_time = 0
        self.rate_limit_delay = 1.0  # 1 second between requests (1 RPS)
        self.session: Optional[aiohttp.ClientSession] = None
        self.rpc_session: Optional[aiohttp.ClientSession] = None
        
    async def start(self) -> bool:
        try:
            if not self.session:
                self.session = aiohttp.ClientSession()
            if not self.rpc_session:
                self.rpc_session = aiohttp.ClientSession()
            return True
        except Exception as e:
            logger.error(f"Failed to initialize Jupiter client: {e}")
            return False
    async def stop(self):
        if self.session:
            await self.session.close()
            self.session = None
        if self.rpc_session:
            await self.rpc_session.close()
            self.rpc_session = None
            
    async def execute_swap(self, params: Dict[str, Any]) -> Dict[str, Any]:
        if not self.session or not self.rpc_session:
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
                        
                    if "swapTransaction" not in swap_data:
                        logger.error(f"Missing swapTransaction in response: {swap_data}")
                        raise RuntimeError("Missing swapTransaction in response")
                        
                    # Execute swap transaction with RPC node
                    await self._enforce_rate_limit(is_rpc=True)
                    async with self.rpc_session.post(self.rpc_url, json={
                        "jsonrpc": "2.0",
                        "id": 1,
                        "method": "sendTransaction",
                        "params": [
                            swap_data["swapTransaction"],
                            {
                                "encoding": "base64",
                                "preflightCommitment": "confirmed",
                                "skipPreflight": False,
                                "maxRetries": 3
                            }
                        ]
                    }) as exec_response:
                        if exec_response.status != 200:
                            error_text = await exec_response.text()
                            logger.error(f"Transaction failed with status {exec_response.status}: {error_text}")
                            raise RuntimeError(f"Transaction failed: {error_text}")
                            
                        result = await exec_response.json()
                        if "error" in result:
                            raise RuntimeError(f"Transaction error: {result['error']}")
                            
                        signature = result.get("result")
                        if not signature:
                            raise RuntimeError("No transaction signature returned")
                            
                        # Wait for transaction confirmation with timeout
                        logger.info(f"Waiting for transaction confirmation: {signature}")
                        confirmation_start = time.time()
                        confirmation_timeout = 60  # 60 seconds timeout
                        
                        while time.time() - confirmation_start < confirmation_timeout:
                            try:
                                if await self._confirm_transaction(signature):
                                    self.circuit_breaker_failures = 0
                                    logger.info(f"Transaction confirmed: {signature}")
                                    return {
                                        "txid": signature,
                                        "status": "confirmed",
                                        "slippage_bps": self.slippage_bps,
                                        "min_amount_out": params.get("minAmountOut"),
                                        "confirmation_time": time.time() - confirmation_start,
                                        "rpc_url": self.rpc_url
                                    }
                            except Exception as e:
                                logger.error(f"RPC error during confirmation: {e}")
                                self.circuit_breaker_failures += 1
                                if self.circuit_breaker_failures >= 5:
                                    raise RuntimeError("Circuit breaker triggered during confirmation")
                            await asyncio.sleep(1)
                            
                        self.circuit_breaker_failures += 1
                        raise RuntimeError(f"Transaction confirmation timeout after {confirmation_timeout} seconds")
                        
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
            
    async def _enforce_rate_limit(self, is_rpc: bool = False):
        current_time = time.time()
        time_since_last = current_time - self.last_request_time
        delay = self.rate_limit_delay * 2 if is_rpc else self.rate_limit_delay
        if time_since_last < delay:
            await asyncio.sleep(delay - time_since_last)
        self.last_request_time = time.time()
            
    async def _confirm_transaction(self, signature: str, max_retries: int = 3) -> bool:
        for attempt in range(max_retries):
            try:
                await self._enforce_rate_limit(is_rpc=True)
                async with self.rpc_session.post(self.rpc_url, json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "getSignatureStatuses",
                    "params": [[signature], {"searchTransactionHistory": True}]
                }) as response:
                    if response.status == 200:
                        data = await response.json()
                        if "error" in data:
                            raise RuntimeError(f"RPC error: {data['error']}")
                            
                        status = data.get("result", {}).get("value", [{}])[0]
                        if status and status.get("confirmationStatus") == "finalized":
                            return True
                            
                    await asyncio.sleep(1 * (2 ** attempt))  # Exponential backoff
            except Exception as e:
                logger.error(f"Failed to confirm transaction {signature}: {e}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(1 * (2 ** attempt))
                    continue
        return False
            
    async def get_quote(self, input_mint: str, output_mint: str, amount: int) -> Dict[str, Any]:
        if not self.session or not self.rpc_session:
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
                # Calculate minAmountOut as 97% of quote amount
                min_amount = int(float(amount) * 0.97)
                params = {
                    "inputMint": input_mint,
                    "outputMint": output_mint,
                    "amount": str(amount),
                    "slippageBps": self.slippage_bps,
                    "onlyDirectRoutes": "true",
                    "asLegacyTransaction": "true",
                    "maxAccounts": "54",
                    "platformFeeBps": "0",
                    "minAmountOut": str(min_amount),
                    "computeUnitPriceMicroLamports": "auto"
                }
                # Get quote from Jupiter API
                await self._enforce_rate_limit()
                async with self.session.get(f"{self.base_url}/quote", params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        if "error" in data:
                            raise RuntimeError(f"Quote error: {data['error']}")
                            
                        # Verify RPC node health
                        await self._enforce_rate_limit(is_rpc=True)
                        async with self.rpc_session.post(self.rpc_url, json={
                            "jsonrpc": "2.0",
                            "id": 1,
                            "method": "getHealth"
                        }) as rpc_response:
                            if rpc_response.status != 200:
                                raise RuntimeError("RPC node health check failed")
                                
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
