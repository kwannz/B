import aiohttp
import asyncio
import base58
import base64
import logging
import os
import time
from typing import Dict, Any, Optional, List
from solders.keypair import Keypair
from solders.transaction import Transaction
from solders.instruction import Instruction as TransactionInstruction
from solders.pubkey import Pubkey
from solders.system_program import ID as SYS_PROGRAM_ID

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
        self.circuit_breaker_cooldown = 300  # 5 minutes
        self.circuit_breaker_threshold = 3  # Lower threshold
        self.last_failure_time = 0
        self.last_request_time = 0
        self.rate_limit_delay = 1.0  # 1 second between requests (1 RPS)
        self.session: Optional[aiohttp.ClientSession] = None
        self.rpc_session: Optional[aiohttp.ClientSession] = None
        
        # Initialize wallet
        wallet_key = os.getenv("walletkey")
        if not wallet_key:
            raise RuntimeError("Missing wallet key")
        self.wallet = Keypair.from_bytes(base58.b58decode(wallet_key))
        
    def _deserialize_instruction(self, instruction_data: Dict[str, Any]) -> TransactionInstruction:
        program_id = Pubkey.from_string(instruction_data["programId"])
        accounts = [
            {
                "pubkey": Pubkey.from_string(account["pubkey"]),
                "is_signer": account.get("isSigner", False),
                "is_writable": account.get("isWritable", False),
                "is_invoked": False
            } for account in instruction_data.get("accounts", [])
        ]
        data = base64.b64decode(instruction_data.get("data", ""))
        return TransactionInstruction(
            accounts=accounts,
            program_id=program_id,
            data=data
        )
        
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
            return {"error": "Client not initialized", "status": "failed"}
            
        if self.circuit_breaker_failures >= self.circuit_breaker_threshold:
            current_time = time.time()
            if current_time - self.last_failure_time < self.circuit_breaker_cooldown:
                return {
                    "error": "Circuit breaker active",
                    "status": "failed",
                    "circuit_breaker_status": {
                        "failures": self.circuit_breaker_failures,
                        "cooldown": self.circuit_breaker_cooldown,
                        "last_failure": self.last_failure_time,
                        "reset_time": self.last_failure_time + self.circuit_breaker_cooldown
                    }
                }
            logger.info("Circuit breaker cooldown expired, resetting failures")
            self.circuit_breaker_failures = 0
            
        await self._enforce_rate_limit()
        current_delay = self.retry_delay
        
        for attempt in range(self.retry_count):
            try:
                # Get quote first if not provided
                if "quoteResponse" not in params:
                    quote = await self.get_quote(
                        input_mint=params["inputMint"],
                        output_mint=params["outputMint"],
                        amount=int(params["amount"])
                    )
                    if "error" in quote:
                        raise RuntimeError(f"Quote error: {quote['error']}")
                    quote_response = quote
                else:
                    quote_response = params.pop("quoteResponse")
                
                # Build swap params
                swap_params = {
                    "userPublicKey": str(self.wallet.pubkey()),
                    "wrapUnwrapSOL": True,
                    "computeUnitPriceMicroLamports": "auto",
                    "asLegacyTransaction": True,
                    "useSharedAccounts": True,
                    "dynamicComputeUnitLimit": True,
                    "prioritizationFeeLamports": "10000000",
                    "quoteResponse": quote_response,
                    **params
                }
                
                logger.info(f"Requesting swap instructions with params: {swap_params}")
                async with self.session.post(f"{self.base_url}/swap-instructions", json=swap_params) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        logger.error(f"Swap failed with status {response.status}: {error_text}")
                        raise RuntimeError(f"Swap failed: {error_text}")
                        
                    instructions = await response.json()
                    if "error" in instructions:
                        raise RuntimeError(f"Swap error: {instructions['error']}")
                        
                    # Build versioned transaction
                    transaction_instructions = []
                    
                    # Add compute budget instructions
                    compute_budget = instructions.get("computeBudgetInstructions", [])
                    for instruction in compute_budget:
                        transaction_instructions.append(self._deserialize_instruction(instruction))
                    
                    # Add setup instructions
                    setup = instructions.get("setupInstructions", [])
                    for instruction in setup:
                        transaction_instructions.append(self._deserialize_instruction(instruction))
                    
                    # Add swap instruction
                    swap = instructions.get("swapInstruction")
                    if not swap:
                        raise RuntimeError("Missing swap instruction")
                    transaction_instructions.append(self._deserialize_instruction(swap))
                    
                    # Add cleanup instruction if present
                    cleanup = instructions.get("cleanupInstruction")
                    if cleanup:
                        transaction_instructions.append(self._deserialize_instruction(cleanup))
                    
                    # Get latest blockhash
                    await self._enforce_rate_limit(is_rpc=True)
                    async with self.rpc_session.post(self.rpc_url, json={
                        "jsonrpc": "2.0",
                        "id": 1,
                        "method": "getLatestBlockhash",
                        "params": [{"commitment": "finalized"}]
                    }) as blockhash_response:
                        if blockhash_response.status != 200:
                            raise RuntimeError("Failed to get latest blockhash")
                        blockhash_data = await blockhash_response.json()
                        blockhash = blockhash_data["result"]["value"]["blockhash"]
                    
                    # Build versioned transaction
                    transaction = Transaction()
                    transaction.message.recent_blockhash = blockhash
                    transaction.message.fee_payer = self.wallet.pubkey()
                    
                    # Add instructions
                    for instruction in transaction_instructions:
                        transaction.message.instructions.append(instruction)
                    
                    # Add address lookup tables if present
                    lookup_tables = instructions.get("addressLookupTableAccounts", [])
                    if lookup_tables:
                        for table in lookup_tables:
                            lookup_table = {
                                "key": Pubkey.from_string(table["publicKey"]),
                                "addresses": [Pubkey.from_string(addr) for addr in table["addresses"]]
                            }
                            transaction.message.address_table_lookups.append(lookup_table)
                    
                    # Sign transaction
                    transaction.sign([self.wallet])
                    serialized_transaction = base64.b64encode(transaction.serialize()).decode('utf-8')
                    
                    # Execute swap transaction with RPC node
                    await self._enforce_rate_limit(is_rpc=True)
                    
                    # Get network priority fee
                    priority_fee = instructions.get("prioritizationFeeLamports", "10000000")
                    
                    # Build transaction options
                    options = {
                        "encoding": "base64",
                        "preflightCommitment": "confirmed",
                        "skipPreflight": False,
                        "maxRetries": 3,
                        "computeUnitLimit": instructions.get("computeUnitLimit", 1400000),
                        "prioritizationFeeLamports": int(priority_fee)
                    }
                    
                    if "minContextSlot" in instructions:
                        options["minContextSlot"] = instructions["minContextSlot"]
                    
                    async with self.rpc_session.post(self.rpc_url, json={
                        "jsonrpc": "2.0",
                        "id": 1,
                        "method": "sendTransaction",
                        "params": [
                            serialized_transaction,
                            options
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
                                        "rpc_url": self.rpc_url,
                                        "blockhash": blockhash
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
                if isinstance(e, aiohttp.ClientError):
                    logger.warning("RPC node connection error, retrying...")
                elif "priorityFee" in str(e).lower():
                    logger.warning("Increasing priority fee due to network congestion")
                    current_fee = int(params["prioritizationFeeLamports"])
                    params["prioritizationFeeLamports"] = str(int(current_fee * 1.5))
                elif "compute budget" in str(e).lower():
                    logger.warning("Increasing compute budget due to network load")
                    params["computeUnitLimit"] = min(
                        int(params.get("computeUnitLimit", 1400000) * 1.5),
                        2000000  # Max 2M compute units
                    )
                
                if attempt < self.retry_count - 1:
                    await asyncio.sleep(current_delay / 1000)
                    current_delay = min(current_delay * 1.5, 10000)  # Cap at 10s
                    continue
                    
                self.circuit_breaker_failures += 1
                self.last_failure_time = time.time()
                return {
                    "error": str(e),
                    "status": "failed",
                    "attempts": attempt + 1,
                    "circuit_breaker_status": {
                        "failures": self.circuit_breaker_failures,
                        "cooldown": self.circuit_breaker_cooldown,
                        "last_failure": self.last_failure_time
                    }
                }
                
        self.circuit_breaker_failures += 1
        self.last_failure_time = time.time()
        return {
            "error": "All retry attempts failed",
            "status": "failed",
            "attempts": self.retry_count,
            "circuit_breaker_status": {
                "failures": self.circuit_breaker_failures,
                "cooldown": self.circuit_breaker_cooldown,
                "last_failure": self.last_failure_time
            }
        }
            
    async def _enforce_rate_limit(self, is_rpc: bool = False):
        current_time = time.time()
        time_since_last = current_time - self.last_request_time
        delay = self.rate_limit_delay * 2 if is_rpc else self.rate_limit_delay
        if time_since_last < delay:
            await asyncio.sleep(delay - time_since_last)
        self.last_request_time = time.time()
            
    async def _confirm_transaction(self, signature: str, max_retries: int = 5) -> bool:
        """Confirm transaction with exponential backoff and proper error handling."""
        current_retry = 0
        retry_delay = 1.0  # Initial delay 1s
        start_time = time.time()
        timeout = 60  # 60s timeout
        
        while current_retry < max_retries and (time.time() - start_time) < timeout:
            try:
                logger.info(f"Confirming transaction {signature} (attempt {current_retry + 1}/{max_retries})")
                await self._enforce_rate_limit(is_rpc=True)
                
                # Check RPC node health first
                async with self.rpc_session.post(self.rpc_url, json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "getHealth"
                }) as health_response:
                    if health_response.status != 200:
                        raise RuntimeError("RPC node health check failed")
                
                # Get transaction status
                async with self.rpc_session.post(self.rpc_url, json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "getSignatureStatuses",
                    "params": [[signature], {"searchTransactionHistory": True}]
                }) as response:
                    if response.status != 200:
                        raise RuntimeError(f"RPC request failed with status {response.status}")
                        
                    data = await response.json()
                    if "error" in data:
                        raise RuntimeError(f"RPC error: {data['error']}")
                        
                    status = data.get("result", {}).get("value", [{}])[0]
                    if not status:
                        logger.warning(f"Transaction {signature} not found, retrying...")
                        current_retry += 1
                        await asyncio.sleep(retry_delay)
                        retry_delay = min(retry_delay * 1.5, 10.0)  # Cap at 10s
                        continue
                        
                    if status.get("err"):
                        logger.error(f"Transaction {signature} failed: {status['err']}")
                        return False
                        
                    if status.get("confirmationStatus") == "finalized":
                        logger.info(f"Transaction {signature} confirmed after {time.time() - start_time:.2f}s")
                        return True
                        
                    logger.info(f"Transaction {signature} status: {status.get('confirmationStatus', 'unknown')}")
                    
            except Exception as e:
                logger.error(f"Error confirming transaction {signature}: {e}")
                if isinstance(e, aiohttp.ClientError):
                    logger.warning("RPC node connection error, switching to backup node")
                    # TODO: Implement RPC node failover
                
            current_retry += 1
            await asyncio.sleep(retry_delay)
            retry_delay = min(retry_delay * 1.5, 10.0)  # Cap at 10s
            
        if (time.time() - start_time) >= timeout:
            logger.error(f"Transaction {signature} confirmation timeout after {timeout}s")
        else:
            logger.error(f"Transaction {signature} confirmation failed after {max_retries} retries")
            
        return False
            
    async def get_quote(self, input_mint: str, output_mint: str, amount: int) -> Dict[str, Any]:
        if not self.session or not self.rpc_session:
            return {"error": "Client not initialized", "status": "failed"}
            
        if self.circuit_breaker_failures >= self.circuit_breaker_threshold:
            current_time = time.time()
            if current_time - self.last_failure_time < self.circuit_breaker_cooldown:
                return {
                    "error": "Circuit breaker active",
                    "status": "failed",
                    "circuit_breaker_status": {
                        "failures": self.circuit_breaker_failures,
                        "cooldown": self.circuit_breaker_cooldown,
                        "last_failure": self.last_failure_time,
                        "reset_time": self.last_failure_time + self.circuit_breaker_cooldown
                    }
                }
            logger.info("Circuit breaker cooldown expired, resetting failures")
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
                    "computeUnitPriceMicroLamports": "auto",
                    "dynamicComputeUnitLimit": "true",
                    "prioritizationFeeLamports": "10000000"
                }
                # Get quote from Jupiter API
                await self._enforce_rate_limit()
                async with self.session.get(f"{self.base_url}/quote", params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        if "error" in data:
                            if "priorityFee" in str(data["error"]).lower():
                                logger.warning("Increasing priority fee due to network congestion")
                                current_fee = int(params["prioritizationFeeLamports"])
                                params["prioritizationFeeLamports"] = str(int(current_fee * 1.5))
                                continue
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
