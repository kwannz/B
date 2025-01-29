from typing import Dict, Any, List
from datetime import datetime
import aiohttp
from .base_agent import BaseAgent
from src.shared.db.database_manager import DatabaseManager

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

    async def collect_market_data(self) -> Dict[str, Any]:
        if not hasattr(self, 'db_manager'):
            self.db_manager = DatabaseManager(
                mongodb_url=self.config['mongodb_url'],
                postgres_url=self.config['postgres_url']
            )

        async with aiohttp.ClientSession() as session:
            all_data = {}
            
            for symbol in self.symbols:
                data = {
                    "symbol": symbol,
                    "timestamp": datetime.now().isoformat(),
                    "price": 0.0,
                    "volume": 0.0,
                    "exchange": "",
                    "raw_data": {}
                }
                
                # Collect data from configured sources
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

                # Store market data in MongoDB
                await self.db_manager.mongodb.market_snapshots.insert_one(data)
                all_data[symbol] = data

            return {
                "timestamp": datetime.now().isoformat(),
                "data": all_data,
                "status": "active"
            }
