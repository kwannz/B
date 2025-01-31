from typing import Dict, Any, List
from datetime import datetime
import numpy as np
from .base_agent import BaseAgent
from src.shared.db.database_manager import DatabaseManager
from src.shared.models.deepseek import DeepSeek1_5B
from src.shared.utils.fallback_manager import FallbackManager

class PortfolioManagerAgent(BaseAgent):
    def __init__(self, agent_id: str, name: str, config: Dict[str, Any]):
        super().__init__(agent_id, name, config)
        self.portfolio = {}
        self.min_order_size = config.get('min_order_size', 0.01)
        self.max_position_size = config.get('max_position_size', 1.0)
        self.rebalance_threshold = config.get('rebalance_threshold', 0.1)
        self.position_config = config.get('position_config', {
            'base_size': 1000,
            'size_multiplier': 1.0,
            'max_position_percent': 0.2,
            'risk_based_sizing': True,
            'volatility_adjustment': True,
            'staged_entry': False,
            'entry_stages': [0.5, 0.3, 0.2],
            'profit_targets': [2.0, 3.0, 5.0],
            'size_per_stage': [0.2, 0.25, 0.2],
            'per_token_limits': {}
        })
        self.model = DeepSeek1_5B(quantized=True)
        
        class LegacyPortfolioSystem:
            async def process(self, request: str) -> Dict[str, Any]:
                return {"text": '{"recommended_position_size": 0.1}', "confidence": 0.5}
                
        self.fallback_manager = FallbackManager(self.model, LegacyPortfolioSystem())

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
        
        if 'position_config' in new_config:
            self.position_config.update(new_config['position_config'])
            
        # Update per-token limits while preserving existing configs
        if 'per_token_limits' in new_config.get('position_config', {}):
            self.position_config['per_token_limits'].update(
                new_config['position_config']['per_token_limits']
            )
            
        self.last_update = datetime.now().isoformat()

    async def generate_orders(self, signals: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not hasattr(self, 'db_manager'):
            self.db_manager = DatabaseManager(
                mongodb_url=self.config['mongodb_url'],
                postgres_url=self.config['postgres_url']
            )
            
        # Get AI-driven portfolio recommendations
        signals_text = "\n".join([f"{s['symbol']}: strength={s.get('signal_strength', 0)}, risk={s.get('risk_level', 'medium')}" for s in signals])
        prompt = f"Analyze these trading signals and recommend position adjustments:\n{signals_text}\nOutput JSON with symbol and recommended_position_size (0-1):"
        
        cached_recommendation = self.cache.get(f"portfolio_recommendation:{hash(signals_text)}")
        if not cached_recommendation:
            recommendation = await self.fallback_manager.execute(prompt)
            if recommendation:
                self.cache.set(f"portfolio_recommendation:{hash(signals_text)}", recommendation)

        orders = []
        for signal in signals:
            symbol = signal['symbol']
            current_position = self.portfolio.get(symbol, 0)
            
            # Apply custom position sizing based on token-specific config
            token_config = self.position_config['per_token_limits'].get(symbol, {})
            base_size = token_config.get('base_size', self.position_config['base_size'])
            size_multiplier = token_config.get('size_multiplier', self.position_config['size_multiplier'])
            max_position_percent = token_config.get('max_position_percent', self.position_config['max_position_percent'])
            
            # Calculate target position using custom sizing rules
            position_size = base_size * size_multiplier
            max_size = self.max_position_size * max_position_percent
            target_position = min(position_size, max_size)
            
            # Apply risk-based sizing if enabled
            if self.position_config['risk_based_sizing']:
                risk_factor = signal.get('risk_level_numeric', 0.5)
                target_position *= (1 - risk_factor)
                
            # Apply volatility adjustment if enabled
            if self.position_config['volatility_adjustment']:
                volatility = signal.get('volatility', 0.5)
                target_position *= max(0.2, 1 - volatility)
            
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
            
            # Handle staged entries if enabled
            if self.position_config['staged_entry'] and trade['side'] == 'buy':
                entry_price = trade['price']
                stages = []
                for target_mult, size_pct in zip(
                    self.position_config['profit_targets'],
                    self.position_config['size_per_stage']
                ):
                    stages.append({
                        'price': entry_price,
                        'target_price': entry_price * target_mult,
                        'size': size * size_pct,
                        'executed': False
                    })
                    
                await self.db_manager.mongodb.staged_entries.insert_one({
                    'symbol': symbol,
                    'trade_id': trade.get('id'),
                    'entry_price': entry_price,
                    'total_size': size,
                    'stages': stages,
                    'timestamp': datetime.now().isoformat()
                })
            
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
