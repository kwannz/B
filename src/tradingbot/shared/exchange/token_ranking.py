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
            known_tokens = {
                "USDC": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                "USDT": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
                "RAY": "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
                "BONK": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
                "JitoSOL": "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
                "mSOL": "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So"
            }
            verified_tokens = []
            for token in tokens_data:
                try:
                    if isinstance(token, dict) and token.get("address") and token.get("symbol"):
                        if token["symbol"] in known_tokens and token["address"] == known_tokens[token["symbol"]]:
                            verified_tokens.append(token)
                            logger.info(f"Added known token {token['symbol']} ({token['address']}) to verified list")
                except (TypeError, ValueError) as e:
                    logger.warning(f"Invalid token data: {e}")
                    continue
            logger.info(f"Found {len(verified_tokens)} valid tokens")
            
            for token in verified_tokens:
                try:
                    # Get price from Jupiter API
                    price_response = await self.session.get(
                        "https://price.jup.ag/v4/price",
                        params={
                            "ids": token["address"],
                            "vsToken": "So11111111111111111111111111111111111111112"  # SOL
                        },
                        timeout=10.0
                    )
                    price_response.raise_for_status()
                    price_data = await price_response.json()
                    
                    if "data" in price_data and token["address"] in price_data["data"]:
                        token_price = price_data["data"][token["address"]]
                        ranked_tokens.append({
                            "address": token["address"],
                            "symbol": token["symbol"],
                            "name": token["name"],
                            "decimals": token["decimals"],
                            "price": float(token_price.get("price", 0)),
                            "confidence": "high",
                            "depth": {
                                "buy_impact": 0.02,  # 2% default impact
                                "sell_impact": 0.02
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
