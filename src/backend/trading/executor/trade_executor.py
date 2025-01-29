from typing import Dict, Any, Optional, List
from datetime import datetime
from .base_executor import BaseExecutor
from ...shared.errors import TradingError
from ...trading_agent.agents.wallet_manager import WalletManager
from .grpc_client import TradeServiceClient

class TradeExecutor(BaseExecutor):
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.wallet_manager = WalletManager()
        self.active_trades: Dict[str, Dict[str, Any]] = {}
        self.trade_history: List[Dict[str, Any]] = []
        self.grpc_client = TradeServiceClient()

    async def execute_trade(self, trade_params: Dict[str, Any]) -> Dict[str, Any]:
        if not self.wallet_manager.is_initialized():
            raise TradingError("Wallet not initialized")

        balance = await self.wallet_manager.get_balance()
        if balance < 0.5:
            raise TradingError("Insufficient balance (minimum 0.5 SOL required)")

        try:
            response = self.grpc_client.execute_trade(
                symbol=trade_params.get("symbol"),
                side=trade_params.get("side"),
                amount=float(trade_params.get("amount", 0)),
                price=float(trade_params.get("price", 0)),
                order_type=trade_params.get("order_type", "market"),
                slippage=float(trade_params.get("slippage", 1.0))
            )
            
            trade = {
                "id": response["order_id"],
                "params": trade_params,
                "status": response["status"],
                "executed_price": response["executed_price"],
                "executed_amount": response["executed_amount"],
                "timestamp": datetime.fromtimestamp(response["timestamp"]).isoformat(),
                "wallet": self.wallet_manager.get_public_key()
            }
            
            self.active_trades[response["order_id"]] = trade
            return trade
        except Exception as e:
            raise TradingError(f"Failed to execute trade: {str(e)}")

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
        try:
            status = self.grpc_client.get_order_status(trade_id)
            if status["status"] == "not_found":
                return next(
                    (trade for trade in self.trade_history if trade["id"] == trade_id),
                    None
                )
            
            trade = self.active_trades.get(trade_id)
            if trade:
                trade.update({
                    "status": status["status"],
                    "filled_amount": status["filled_amount"],
                    "average_price": status["average_price"]
                })
                if status["status"] not in ["pending", "executing"]:
                    self.trade_history.append(trade)
                    del self.active_trades[trade_id]
            return trade
        except Exception:
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
