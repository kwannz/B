import asyncio
import logging
from typing import List, Dict, Any
from decimal import Decimal
from datetime import datetime

from .jupiter_client import JupiterClient
from .token_ranking import TokenRankingService

logger = logging.getLogger(__name__)

class MultiTokenTrader:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.jupiter_client = JupiterClient(config)
        self.token_ranking = None  # Will be initialized in start()
        self.trade_amount = config.get("trade_amount", 0.066)  # SOL
        self.max_concurrent_trades = config.get("max_concurrent_trades", 1)
        self.trade_delay = config.get("trade_delay", 5)  # seconds
        self.failures = 0
        self.max_failures = config.get("max_failures", 5)
        self.cooldown_period = config.get("cooldown_period", 600)  # 10 minutes
        self.last_failure_time = 0
        self.trades = []
        
    async def start(self) -> bool:
        try:
            if not await self.jupiter_client.start():
                logger.error("Failed to start Jupiter client")
                return False
                
            self.token_ranking = await TokenRankingService.create(self.config)
            if not await self.token_ranking.start():
                logger.error("Failed to start token ranking service")
                return False
                
            return True
        except Exception as e:
            logger.error(f"Failed to start services: {e}")
            return False
        
    async def stop(self) -> bool:
        try:
            if self.token_ranking:
                await self.token_ranking.stop()
            await self.jupiter_client.stop()
            return True
        except Exception as e:
            logger.error(f"Failed to stop services: {e}")
            return False
        
    async def execute_trades(self, amount_per_trade: float = 0.066) -> List[Dict[str, Any]]:
        """Execute trades for top 10 tokens.
        
        Args:
            amount_per_trade: Amount of SOL to trade per token (default: 0.066)
        """
        if not self.token_ranking:
            logger.error("Token ranking service not initialized")
            return []
            
        self.trade_amount = amount_per_trade
            
        if self.failures >= self.max_failures:
            current_time = datetime.now().timestamp()
            if current_time - self.last_failure_time < self.cooldown_period:
                logger.warning("Circuit breaker active, waiting for cooldown")
                return []
            self.failures = 0
            
        try:
            top_tokens = await self.token_ranking.get_top_tokens(10)
            trade_results = []
            
            for token in top_tokens:
                try:
                    result = await self._execute_single_trade(token)
                    if result:
                        trade_results.append(result)
                    await asyncio.sleep(self.trade_delay)
                except Exception as e:
                    logger.error(f"Failed to execute trade for {token['symbol']}: {e}")
                    self.failures += 1
                    if self.failures >= self.max_failures:
                        self.last_failure_time = datetime.now().timestamp()
                        break
                        
            return trade_results
            
        except Exception as e:
            logger.error(f"Failed to execute trades: {e}")
            self.failures += 1
            if self.failures >= self.max_failures:
                self.last_failure_time = datetime.now().timestamp()
            return []
            
    async def _execute_single_trade(self, token: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a single trade with proper validation and retries."""
        if not token or "symbol" not in token or "address" not in token:
            return {
                "status": "failed",
                "error": "Invalid token data",
                "timestamp": datetime.now().isoformat()
            }
            
        trade_result: Dict[str, Any] = {
            "symbol": token["symbol"],
            "address": token["address"],
            "amount": self.trade_amount,
            "timestamp": datetime.now().isoformat(),
            "status": "pending",
            "error": None,
            "confidence": token.get("confidence", "unknown"),
            "depth": token.get("depth", {})
        }
        
        if not self.jupiter_client:
            trade_result.update({
                "status": "failed",
                "error": "Jupiter client not initialized"
            })
            return trade_result
            
        try:
            # Calculate amount in lamports
            amount_lamports = int(self.trade_amount * 1e9)
            
            # Get quote with proper slippage
            quote = await self.jupiter_client.get_quote(
                input_mint=token["address"],
                output_mint="So11111111111111111111111111111111111111112",  # SOL
                amount=amount_lamports
            )
            
            if "error" in quote:
                logger.error(f"Quote error for {token['symbol']}: {quote['error']}")
                trade_result.update({
                    "status": "failed",
                    "error": quote["error"]
                })
                return trade_result
                
            # Validate price impact
            if float(quote.get("priceImpactPct", 100)) > self.config.get("max_price_impact", 1.0):
                logger.warning(f"Price impact too high for {token['symbol']}")
                trade_result.update({
                    "status": "failed",
                    "error": "Price impact too high",
                    "price_impact": float(quote.get("priceImpactPct", 0))
                })
                return trade_result
                
            # Execute trade with proper validation and retries
            retry_count = self.config.get("retry_count", 3)
            retry_delay = self.config.get("retry_delay", 1000)
            
            for attempt in range(retry_count):
                try:
                    # Execute trade with Jupiter
                    swap_result = await self.jupiter_client.execute_swap({
                        "inputMint": token["address"],
                        "outputMint": "So11111111111111111111111111111111111111112",  # SOL
                        "amount": str(amount_lamports),
                        "slippageBps": 250,  # 2.5% slippage
                        "quoteResponse": quote,
                        "computeUnitLimit": 1400000,
                        "prioritizationFeeLamports": "10000000"
                    })
                    
                    if "error" in swap_result:
                        trade_result.update({
                            "status": "failed",
                            "error": swap_result["error"]
                        })
                        return trade_result
                    
                    # Update trade result with success
                    trade_result.update({
                        "quote": quote,
                        "swap": swap_result,
                        "status": "executed",
                        "price_impact": float(quote.get("priceImpactPct", 0)),
                        "confidence": token["confidence"],
                        "depth": token["depth"],
                        "slippage_bps": 250,
                        "retry_count": retry_count,
                        "retry_delay": retry_delay,
                        "transaction_hash": swap_result.get("txid")
                    })
            
                    # Log trade details
                    logger.info(f"Trade executed for {token['symbol']}: {trade_result}")
                    self.failures = 0  # Reset failures on success
                    return trade_result
                except Exception as e:
                    if attempt < retry_count - 1:
                        logger.warning(f"Retrying trade for {token['symbol']} after error: {e}")
                        await asyncio.sleep(retry_delay / 1000 * (1.5 ** attempt))
                        continue
                    logger.error(f"All retries failed for {token['symbol']}: {e}")
                    raise
            
        except Exception as e:
            logger.error(f"Trade execution error for {token['symbol']}: {e}")
            raise
