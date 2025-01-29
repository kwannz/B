from typing import Dict, Any, List
from datetime import datetime
import numpy as np
from .base_agent import BaseAgent
from src.shared.db.database_manager import DatabaseManager

class PortfolioManagerAgent(BaseAgent):
    def __init__(self, agent_id: str, name: str, config: Dict[str, Any]):
        super().__init__(agent_id, name, config)
        self.portfolio = {}
        self.min_order_size = config.get('min_order_size', 0.01)
        self.max_position_size = config.get('max_position_size', 1.0)
        self.rebalance_threshold = config.get('rebalance_threshold', 0.1)

    async def start(self):
        self.status = "active"
        self.last_update = datetime.now().isoformat()

    async def stop(self):
        self.status = "inactive"
        self.last_update = datetime.now().isoformat()

    async def update_config(self, new_config: Dict[str, Any]):
        self.config = new_config
        self.min_order_size = new_config.get('min_order_size', self.min_order_size)
        self.max_position_size = new_config.get('max_position_size', self.max_position_size)
        self.rebalance_threshold = new_config.get('rebalance_threshold', self.rebalance_threshold)
        self.last_update = datetime.now().isoformat()

    async def generate_orders(self, signals: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not hasattr(self, 'db_manager'):
            self.db_manager = DatabaseManager(
                mongodb_url=self.config['mongodb_url'],
                postgres_url=self.config['postgres_url']
            )

        orders = []
        for signal in signals:
            symbol = signal['symbol']
            current_position = self.portfolio.get(symbol, 0)
            target_position = signal['position_size']
            
            if abs(target_position - current_position) < self.rebalance_threshold:
                continue
                
            order_size = target_position - current_position
            if abs(order_size) < self.min_order_size:
                continue
                
            if abs(target_position) > self.max_position_size:
                order_size = np.sign(order_size) * (self.max_position_size - abs(current_position))
            
            order = {
                "symbol": symbol,
                "side": "buy" if order_size > 0 else "sell",
                "size": abs(order_size),
                "type": "market",
                "timestamp": datetime.now().isoformat(),
                "status": "pending",
                "meta_info": {
                    "signal_strength": signal.get('signal_strength', 0),
                    "risk_level": signal.get('risk_level', 'medium'),
                    "current_position": current_position,
                    "target_position": target_position
                }
            }
            orders.append(order)
            
            # Store order in MongoDB
            await self.db_manager.mongodb.orders.insert_one(order)
            
        return orders

    async def update_portfolio(self, trades: List[Dict[str, Any]]):
        for trade in trades:
            symbol = trade['symbol']
            size = trade['size'] * (1 if trade['side'] == 'buy' else -1)
            self.portfolio[symbol] = self.portfolio.get(symbol, 0) + size
            
            # Store portfolio update in MongoDB
            await self.db_manager.mongodb.portfolio_updates.insert_one({
                "timestamp": datetime.now().isoformat(),
                "symbol": symbol,
                "trade_id": trade.get('id'),
                "size": size,
                "new_position": self.portfolio[symbol],
                "meta_info": {
                    "trade_price": trade.get('price'),
                    "trade_type": trade.get('type', 'market'),
                    "trade_side": trade['side']
                }
            })
            
        self.last_update = datetime.now().isoformat()
