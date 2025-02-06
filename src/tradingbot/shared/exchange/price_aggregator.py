import asyncio
import logging
from typing import Dict, Any, Optional
from .jupiter_client import JupiterClient
from .solscan_client import SolscanClient

logger = logging.getLogger(__name__)

class PriceAggregator:
    def __init__(self, config: Dict[str, Any]) -> None:
        self.jupiter_client = JupiterClient(config.get("jupiter", {}))
        self.solscan_client = SolscanClient(config.get("solscan", {}))
        self.max_price_diff = config.get("max_price_diff", 0.05)  # 5%
        self.circuit_breaker_threshold = config.get("circuit_breaker", 0.10)  # 10%
        self.retry_count = config.get("retry_count", 3)
        self.retry_delay = config.get("retry_delay", 1000)
        
    async def start(self) -> None:
        await self.jupiter_client.start()
        await self.solscan_client.start()
        
    async def stop(self) -> None:
        await self.jupiter_client.stop()
        await self.solscan_client.stop()
        
    async def _get_jupiter_price(self, token_in: str, token_out: str, amount: float) -> Dict[str, Any]:
        try:
            quote = await self.jupiter_client.get_quote(
                input_mint=token_in,
                output_mint=token_out,
                amount=int(amount * 1e9)  # Convert SOL to lamports
            )
            if "error" in quote:
                return {"error": quote["error"]}
            
            price = float(quote["outAmount"]) / (float(quote["inAmount"]) * 1e3)
            return {
                "price": price,
                "quote": quote,
                "source": "jupiter"
            }
        except Exception as e:
            logger.error(f"Error getting Jupiter price: {e}")
            return {"error": str(e)}
            
    async def _get_solscan_price(self, token_address: str) -> Dict[str, Any]:
        try:
            market_info = await self.solscan_client.get_market_info(token_address)
            if "error" in market_info:
                return {"error": market_info["error"]}
            
            if "priceUsdt" not in market_info:
                return {"error": "Price not available"}
                
            return {
                "price": float(market_info["priceUsdt"]),
                "market_info": market_info,
                "source": "solscan"
            }
        except Exception as e:
            logger.error(f"Error getting Solscan price: {e}")
            return {"error": str(e)}
            
    async def get_aggregated_price(self, token_in: str, token_out: str, amount: float) -> Dict[str, Any]:
        jupiter_price = await self._get_jupiter_price(token_in, token_out, amount)
        solscan_price = await self._get_solscan_price(token_in)
        
        if not jupiter_price.get("error") and not solscan_price.get("error"):
            price_diff = abs(jupiter_price["price"] - solscan_price["price"]) / solscan_price["price"]
            
            # Check for large price movements
            if price_diff > self.circuit_breaker_threshold:
                logger.error(f"Circuit breaker triggered: price difference {price_diff:.2%}")
                return {
                    "error": "Circuit breaker triggered",
                    "price_diff": price_diff,
                    "jupiter_price": jupiter_price["price"],
                    "solscan_price": solscan_price["price"],
                    "jupiter_source": jupiter_price["source"],
                    "solscan_source": solscan_price["source"]
                }
            
            if price_diff > self.max_price_diff:
                logger.warning(f"Large price difference detected: {price_diff:.2%}")
                
            # Check for large price movements that should trigger circuit breaker
            if amount > 100 and price_diff > self.circuit_breaker_threshold:
                return {
                    "error": "Circuit breaker triggered",
                    "price_diff": price_diff,
                    "jupiter_price": jupiter_price["price"],
                    "solscan_price": solscan_price["price"]
                }
                
            # Use Jupiter price for execution but validate with Solscan
            # Check for large price movements that should trigger circuit breaker
            if amount > 100 and price_diff > self.circuit_breaker_threshold:
                return {
                    "error": "Circuit breaker triggered",
                    "price_diff": price_diff,
                    "jupiter_price": jupiter_price.get("price"),
                    "solscan_price": solscan_price.get("price")
                }

            # Check Jupiter price first
            if jupiter_price.get("error"):
                return {
                    "error": "Jupiter price not available",
                    "jupiter_error": jupiter_price.get("error"),
                    "solscan_error": solscan_price.get("error")
                }

            # For large trades, require validation price
            if amount > 100:
                if solscan_price.get("error"):
                    return {
                        "error": "Cannot validate large trade - validation price not available",
                        "price": jupiter_price["price"],
                        "quote": jupiter_price["quote"],
                        "source": jupiter_price["source"]
                    }
                if price_diff > self.circuit_breaker_threshold:
                    return {
                        "error": "Circuit breaker triggered",
                        "price_diff": price_diff,
                        "jupiter_price": jupiter_price["price"],
                        "solscan_price": solscan_price["price"]
                    }

            # Both price sources available
            if not solscan_price.get("error"):
                return {
                    "price": jupiter_price["price"],
                    "validation_price": solscan_price["price"],
                    "price_diff": price_diff,
                    "quote": jupiter_price["quote"],
                    "market_info": solscan_price["market_info"],
                    "source": jupiter_price["source"],
                    "validation_source": solscan_price["source"]
                }

            # Only Jupiter available
            return {
                "price": jupiter_price["price"],
                "quote": jupiter_price["quote"],
                "source": jupiter_price["source"],
                "fallback": True
            }
            
            # Check for large price movements that should trigger circuit breaker
            if amount > 100 and price_diff > self.circuit_breaker_threshold:
                return {
                    "error": "Circuit breaker triggered",
                    "price_diff": price_diff,
                    "jupiter_price": jupiter_price["price"],
                    "solscan_price": solscan_price["price"]
                }
                
            return {
                "price": jupiter_price["price"],
                "quote": jupiter_price["quote"],
                "source": jupiter_price["source"],
                "fallback": True
            }
            
        # If Jupiter fails, try Solscan
        if not solscan_price.get("error"):
            return {
                "price": solscan_price["price"],
                "market_info": solscan_price["market_info"],
                "source": solscan_price["source"],
                "fallback": True
            }
            
        # If Solscan fails, try Jupiter
        if not jupiter_price.get("error"):
            return {
                "price": jupiter_price["price"],
                "quote": jupiter_price["quote"],
                "source": jupiter_price["source"],
                "fallback": True
            }
            
        return {
            "error": "All price sources failed",
            "jupiter_error": jupiter_price.get("error"),
            "solscan_error": solscan_price.get("error")
        }
