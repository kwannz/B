from typing import Dict, Any, List
from datetime import datetime
import numpy as np
from .base_agent import BaseAgent
from src.shared.db.database_manager import DatabaseManager

class RiskManagerAgent(BaseAgent):
    def __init__(self, agent_id: str, name: str, config: Dict[str, Any]):
        super().__init__(agent_id, name, config)
        self.risk_metrics = config.get('risk_metrics', ['volatility', 'drawdown', 'var'])
        self.position_limits = config.get('position_limits', {})
        self.risk_levels = config.get('risk_levels', {'low': 0.1, 'medium': 0.2, 'high': 0.3})

    async def start(self):
        self.status = "active"
        self.last_update = datetime.now().isoformat()

    async def stop(self):
        self.status = "inactive"
        self.last_update = datetime.now().isoformat()

    async def update_config(self, new_config: Dict[str, Any]):
        self.config = new_config
        self.risk_metrics = new_config.get('risk_metrics', self.risk_metrics)
        self.position_limits = new_config.get('position_limits', self.position_limits)
        self.risk_levels = new_config.get('risk_levels', self.risk_levels)
        self.last_update = datetime.now().isoformat()

    async def calculate_position_size(self, symbol: str, signal_strength: float) -> Dict[str, Any]:
        if not hasattr(self, 'db_manager'):
            self.db_manager = DatabaseManager(
                mongodb_url=self.config['mongodb_url'],
                postgres_url=self.config['postgres_url']
            )

        # Get historical market data for risk calculations
        cursor = self.db_manager.mongodb.market_snapshots.find(
            {"symbol": symbol}
        ).sort("timestamp", -1).limit(30)  # Last 30 data points
        
        market_data = await cursor.to_list(length=30)
        if not market_data:
            return {
                "symbol": symbol,
                "timestamp": datetime.now().isoformat(),
                "position_size": 0,
                "risk_metrics": {},
                "status": "no_data"
            }

        # Calculate risk metrics
        prices = [d['price'] for d in market_data]
        returns = np.diff(prices) / prices[:-1]
        
        risk_metrics = {}
        
        # Volatility
        if 'volatility' in self.risk_metrics:
            risk_metrics['volatility'] = float(np.std(returns) * np.sqrt(365))

        # Maximum Drawdown
        if 'drawdown' in self.risk_metrics:
            cumulative_returns = np.cumprod(1 + returns)
            rolling_max = np.maximum.accumulate(cumulative_returns)
            drawdowns = (rolling_max - cumulative_returns) / rolling_max
            risk_metrics['max_drawdown'] = float(np.max(drawdowns))

        # Value at Risk (VaR)
        if 'var' in self.risk_metrics:
            risk_metrics['var_95'] = float(np.percentile(returns, 5))
            risk_metrics['var_99'] = float(np.percentile(returns, 1))

        # Calculate position size based on risk metrics and signal strength
        base_position = self.position_limits.get(symbol, 1.0)
        risk_score = min(
            risk_metrics.get('volatility', 0.5),
            abs(risk_metrics.get('var_95', 0.1)) * 10,
            risk_metrics.get('max_drawdown', 0.5) * 2
        )
        
        # Adjust position size based on risk score and signal strength
        risk_adjusted_size = base_position * (1 - risk_score) * signal_strength
        
        # Apply risk level multiplier
        risk_level = 'medium'
        for level, threshold in sorted(self.risk_levels.items(), key=lambda x: x[1]):
            if risk_score <= threshold:
                risk_level = level
                break
        
        position_size = risk_adjusted_size * self.risk_levels[risk_level]

        analysis_result = {
            "symbol": symbol,
            "timestamp": datetime.now().isoformat(),
            "position_size": position_size,
            "risk_metrics": risk_metrics,
            "risk_level": risk_level,
            "signal_strength": signal_strength,
            "status": "active"
        }

        # Store analysis in MongoDB
        await self.db_manager.mongodb.risk_analysis.insert_one({
            **analysis_result,
            "meta_info": {
                "data_points": len(market_data),
                "risk_thresholds": self.risk_levels,
                "base_position": base_position
            }
        })

        return analysis_result
