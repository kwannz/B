import aiohttp
import asyncio
import logging
from typing import List, Dict, Any
from decimal import Decimal

logger = logging.getLogger(__name__)

class TokenRankingService:
    def __init__(self, session: aiohttp.ClientSession, config: Dict[str, Any]):
        self.base_url = "https://quote-api.jup.ag/v6"
        self.session = session
        self.min_daily_volume = config.get("min_daily_volume", 100000)  # $100k minimum
        self.min_depth_ratio = config.get("min_depth_ratio", 0.1)  # 10% max price impact
        self.update_interval = config.get("update_interval", 300)  # 5 minutes
        self.last_update = 0
        self.cached_tokens = []
        
    @classmethod
    async def create(cls, config: Dict[str, Any]) -> 'TokenRankingService':
        session = aiohttp.ClientSession()
        return cls(session=session, config=config)
        
    async def start(self) -> bool:
        return True
        
    async def stop(self):
        try:
            if self.session:
                await self.session.close()
                self.session = None
            return True
        except Exception as e:
            logger.error(f"Failed to close session: {e}")
            return False
            
    async def get_top_tokens(self, limit: int = 10) -> List[Dict[str, Any]]:
        if not self.session:
            await self.start()
            
        current_time = int(asyncio.get_event_loop().time())
        if current_time - self.last_update > self.update_interval:
            try:
                await self._update_token_rankings()
                self.last_update = current_time
            except Exception as e:
                logger.error(f"Failed to update token rankings: {e}")
                if not self.cached_tokens:
                    raise
        return self.cached_tokens[:limit]
            
    async def _update_token_rankings(self):
        ranked_tokens = []
        
        try:
            tokens_response = await self.session.get("https://token.jup.ag/all")
            tokens_response.raise_for_status()
            tokens_data = await tokens_response.json()
            
            logger.info(f"Got {len(tokens_data)} tokens from Jupiter API")
            # Start with well-known tokens
            known_tokens = ["SOL", "USDC", "USDT", "RAY", "BONK", "JitoSOL", "mSOL"]
            verified_tokens = []
            for token in tokens_data:
                try:
                    if isinstance(token, dict) and token.get("address") and token.get("symbol"):
                        if token["symbol"] in known_tokens and token["address"] != "So11111111111111111111111111111111111111112":
                            verified_tokens.append(token)
                            logger.info(f"Added known token {token['symbol']} to verified list")
                except (TypeError, ValueError) as e:
                    logger.warning(f"Invalid token data: {e}")
                    continue
            logger.info(f"Found {len(verified_tokens)} valid tokens")
            
            for token in verified_tokens[:10]:
                try:
                    quote_response = await self.session.get(
                        "https://quote-api.jup.ag/v6/quote",
                        params={
                            "inputMint": "So11111111111111111111111111111111111111112",  # SOL
                            "outputMint": token["address"],
                            "amount": "1000000000",  # 1 SOL
                            "slippageBps": "250",  # 2.5% slippage
                            "onlyDirectRoutes": "false",
                            "asLegacyTransaction": "true"
                        },
                        timeout=10.0
                    )
                    quote_response.raise_for_status()
                    quote_data = await quote_response.json()
                    
                    if "data" in quote_data:
                        quote = quote_data["data"]
                        ranked_tokens.append({
                            "address": token["address"],
                            "symbol": token["symbol"],
                            "name": token["name"],
                            "decimals": token["decimals"],
                            "price": float(quote.get("outAmount", 0)) / 1e9,  # Convert to SOL
                            "confidence": "high",
                            "depth": {
                                "buy_impact": float(quote.get("priceImpactPct", 0.02)),
                                "sell_impact": float(quote.get("priceImpactPct", 0.02))
                            }
                        })
                        logger.info(f"Added token {token['symbol']} to ranked list")
                except Exception as e:
                    logger.error(f"Error getting price data for {token['symbol']}: {e}")
                    continue
                await asyncio.sleep(1)  # Rate limiting
            
            self.cached_tokens = ranked_tokens
            logger.info(f"Updated top tokens: {[t['symbol'] for t in ranked_tokens]}")
        except Exception as e:
            logger.error(f"Error updating token rankings: {e}")
            if not self.cached_tokens:
                raise
