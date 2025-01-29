from typing import Dict, Any, Optional, List
from datetime import datetime
from .base_executor import BaseExecutor
from src.shared.models.errors import TradingError
from ...trading_agent.agents.wallet_manager import WalletManager

class TradeExecutor(BaseExecutor):
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.wallet_manager = WalletManager()
        self.active_trades: Dict[str, Dict[str, Any]] = {}
        self.trade_history: List[Dict[str, Any]] = []

    async def validate_with_ai(self, trade_params: Dict[str, Any]) -> Dict[str, Any]:
        """Validate trade parameters using DeepSeek R1 model."""
        from src.shared.ai_analyzer import AIAnalyzer
        analyzer = AIAnalyzer()
        await analyzer.start()
        try:
            validation = await analyzer.validate_trade(trade_params)
            
            # Check validation result
            if not validation.get("is_valid", False):
                raise TradingError(f"AI validation failed: {validation.get('reason', 'Unknown reason')}")
                
            # Verify risk metrics are within acceptable bounds
            risk = validation.get("risk_assessment", {})
            if risk.get("risk_level", 1.0) > 0.8:
                raise TradingError(f"Risk level too high: {risk.get('risk_level')}")
            if risk.get("max_loss", 100.0) > trade_params.get("max_loss_threshold", 10.0):
                raise TradingError(f"Maximum potential loss exceeds threshold: {risk.get('max_loss')}%")
                
            # Verify market conditions alignment
            metrics = validation.get("validation_metrics", {})
            if metrics.get("market_conditions_alignment", 0.0) < 0.6:
                raise TradingError(f"Poor market conditions alignment: {metrics.get('market_conditions_alignment')}")
            if metrics.get("risk_reward_ratio", 0.0) < 1.5:
                raise TradingError(f"Insufficient risk-reward ratio: {metrics.get('risk_reward_ratio')}")
                
            return validation
        finally:
            await analyzer.stop()

    async def execute_trade(self, trade_params: Dict[str, Any]) -> Dict[str, Any]:
        if not self.wallet_manager.is_initialized():
            raise TradingError("Wallet not initialized")

        balance = await self.wallet_manager.get_balance()
        if balance < 0.5:
            raise TradingError("Insufficient balance (minimum 0.5 SOL required)")
            
        # Validate trade with AI before execution
        try:
            validation = await self.validate_with_ai(trade_params)
            trade_params["ai_validation"] = validation
        except TradingError as e:
            raise e
        except Exception as e:
            # Log but continue if AI validation fails
            trade_params["ai_validation"] = {"error": str(e)}

        trade_id = f"trade_{int(datetime.now().timestamp())}"
        trade = {
            "id": trade_id,
            "params": trade_params,
            "status": "pending",
            "timestamp": datetime.now().isoformat(),
            "wallet": self.wallet_manager.get_public_key()
        }
        
        if trade_params.get("use_go_executor", True):  # Default to using Go executor
            from .go_executor_client import execute_trade_in_go
            try:
                trade_result = await execute_trade_in_go(trade)
                self.active_trades[trade_id] = trade_result
                return trade_result
            except TradingError as e:
                trade["status"] = "failed"
                trade["error"] = str(e)
                self.active_trades[trade_id] = trade
                return trade
            
        self.active_trades[trade_id] = trade
        return trade

    async def cancel_trade(self, trade_id: str) -> bool:
        if trade_id not in self.active_trades:
            return False
            
        trade = self.active_trades[trade_id]
        trade["status"] = "cancelled"
        trade["cancelled_at"] = datetime.now().isoformat()
        
        self.trade_history.append(trade)
        del self.active_trades[trade_id]
        return True

    async def get_trade_status(self, trade_id: str) -> Optional[Dict[str, Any]]:
        return self.active_trades.get(trade_id) or next(
            (trade for trade in self.trade_history if trade["id"] == trade_id),
            None
        )

    def get_active_trades(self) -> List[Dict[str, Any]]:
        return list(self.active_trades.values())

    def get_trade_history(self) -> List[Dict[str, Any]]:
        return self.trade_history

    async def start(self) -> bool:
        if not await super().start():
            return False
            
        if not self.wallet_manager.is_initialized():
            self.status = "error"
            self.last_update = datetime.now().isoformat()
            return False
            
        return True

    async def stop(self) -> bool:
        for trade_id in list(self.active_trades.keys()):
            await self.cancel_trade(trade_id)
        return await super().stop()
