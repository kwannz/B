from typing import Dict, Any, List, Optional
from datetime import datetime
import asyncio
import aiohttp
import logging
import json
from .base_agent import BaseAgent
from src.shared.db.database_manager import DatabaseManager
from src.shared.utils.batch_processor import BatchProcessor
from src.shared.utils.fallback_manager import FallbackManager

class MarketDataBatchProcessor(BatchProcessor[str, Dict[str, Any]]):
    def __init__(self, agent):
        super().__init__(max_batch=16, timeout=50)
        self.agent = agent
        
    async def _process_items(self, items: List[str]) -> List[Dict[str, Any]]:
        try:
            async with aiohttp.ClientSession() as session:
                tasks = []
                for symbol in items:
                    tasks.append(self.agent._fetch_symbol_data(session, symbol))
                results = await asyncio.gather(*tasks, return_exceptions=True)
                processed_results: List[Dict[str, Any]] = []
                for r, symbol in zip(results, items):
                    if isinstance(r, Exception):
                        processed_results.append(self._create_default_data(symbol))
                    else:
                        # Type assertion to ensure r is Dict[str, Any]
                        processed_results.append(r if isinstance(r, dict) else self._create_default_data(symbol))
                return processed_results
        except Exception as e:
            logging.error(f"Batch processing error: {str(e)}")
            return [self._create_default_data(symbol) for symbol in items]
            
    def _create_default_data(self, symbol: str) -> Dict[str, Any]:
        return {
            "symbol": symbol,
            "timestamp": datetime.now().isoformat(),
            "price": 0.0,
            "volume": 0.0,
            "exchange": "fallback",
            "raw_data": {}
        }

class MarketDataAgent(BaseAgent):
    def __init__(self, agent_id: str, name: str, config: Dict[str, Any]):
        super().__init__(agent_id, name, config)
        self.data_sources = config.get('data_sources', {
            'coingecko': True,
            'binance': True,
            'okx': True
        })
        self.update_interval = config.get('update_interval', 60)
        self.symbols = config.get('symbols', ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'])
        self.batch_processor = MarketDataBatchProcessor(self)
        
        class LegacyMarketDataSystem:
            async def process(self, symbols: List[str]) -> List[Dict[str, Any]]:
                return [{
                    "symbol": symbol,
                    "timestamp": datetime.now().isoformat(),
                    "price": 0.0,
                    "volume": 0.0,
                    "exchange": "legacy",
                    "raw_data": {}
                } for symbol in symbols]
                
        self.fallback_manager = FallbackManager(self.batch_processor, LegacyMarketDataSystem())
        
    async def start(self):
        self.status = "active"
        self.last_update = datetime.now().isoformat()

    async def stop(self):
        self.status = "inactive"
        self.last_update = datetime.now().isoformat()

    async def update_config(self, new_config: Dict[str, Any]):
        self.config = new_config
        self.data_sources = new_config.get('data_sources', self.data_sources)
        self.update_interval = new_config.get('update_interval', self.update_interval)
        self.symbols = new_config.get('symbols', self.symbols)
        self.last_update = datetime.now().isoformat()

    async def _fetch_symbol_data(self, session: aiohttp.ClientSession, symbol: str) -> Dict[str, Any]:
        data = {
            "symbol": symbol,
            "timestamp": datetime.now().isoformat(),
            "price": 0.0,
            "volume": 0.0,
            "exchange": "",
            "raw_data": {}
        }
        
        if self.data_sources.get('coingecko'):
            try:
                async with session.get(
                    f"https://api.coingecko.com/api/v3/simple/price",
                    params={
                        "ids": symbol.split('/')[0].lower(),
                        "vs_currencies": "usd",
                        "include_24hr_vol": True
                    }
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        coin_id = symbol.split('/')[0].lower()
                        if coin_id in result:
                            data["price"] = result[coin_id]["usd"]
                            data["volume"] = result[coin_id].get("usd_24h_vol", 0)
                            data["exchange"] = "coingecko"
                            data["raw_data"]["coingecko"] = result[coin_id]
            except Exception as e:
                data["raw_data"]["coingecko_error"] = str(e)
        
        return data

    async def collect_market_data(self) -> Dict[str, Any]:
        if not hasattr(self, 'db_manager'):
            self.db_manager = DatabaseManager(
                mongodb_url=self.config['mongodb_url'],
                postgres_url=self.config['postgres_url']
            )

        all_data = {}
        
        # Try to get cached data first
        for symbol in self.symbols:
            cached_data = self.cache.get_market_data(symbol)
            if cached_data:
                all_data[symbol] = cached_data.dict()
                continue
                
        # Process remaining symbols in batches with fallback
        remaining_symbols = [s for s in self.symbols if s not in all_data]
        if remaining_symbols:
            try:
                results = await self.fallback_manager.execute_batch(remaining_symbols)
                for symbol, data in zip(remaining_symbols, results):
                    if data:  # Only store valid results
                        await self.db_manager.mongodb.market_snapshots.insert_one(data)
                        self.cache.set(f"market_data:{symbol}", data, ttl=self.update_interval * 2)
                        all_data[symbol] = data
            except Exception as e:
                logging.error(f"Failed to process market data batch: {str(e)}")
                # Use legacy system as final fallback
                for symbol in remaining_symbols:
                    all_data[symbol] = {
                        "symbol": symbol,
                        "timestamp": datetime.now().isoformat(),
                        "price": 0.0,
                        "volume": 0.0,
                        "exchange": "legacy",
                        "raw_data": {"error": str(e)}
                    }

        return {
            "timestamp": datetime.now().isoformat(),
            "data": all_data,
            "status": "active"
        }
