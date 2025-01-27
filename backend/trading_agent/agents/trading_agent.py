from datetime import datetime
from typing import Dict, Any
from .base_agent import BaseAgent
from .wallet_manager import WalletManager

class TradingAgent(BaseAgent):
    def __init__(self, agent_id: str, name: str, config: Dict[str, Any]):
        super().__init__(agent_id, name, config)
        self.strategy_type = config.get('strategy_type', 'default')
        self.risk_level = config.get('parameters', {}).get('riskLevel', 'low')
        self.trade_size = config.get('parameters', {}).get('tradeSize', 1)
        self.wallet = WalletManager()

    async def start(self):
        """Start trading operations"""
        try:
            # Verify wallet balance before starting
            balance = await self.get_wallet_balance()
            if balance < 0.5:  # Minimum 0.5 SOL required
                raise ValueError(f"Insufficient balance: {balance} SOL (minimum 0.5 SOL required)")
            
            self.status = "active"
            self.last_update = datetime.now().isoformat()
            # TODO: Implement trading logic
        except Exception as e:
            self.status = "error"
            self.last_update = datetime.now().isoformat()
            raise Exception(f"Failed to start trading agent: {str(e)}")

    async def stop(self):
        """Stop trading operations"""
        self.status = "inactive"
        self.last_update = datetime.now().isoformat()
        # TODO: 清理交易状态

    async def update_config(self, new_config: Dict[str, Any]):
        """Update trading configuration"""
        self.config = new_config
        self.strategy_type = new_config.get('strategy_type', self.strategy_type)
        self.risk_level = new_config.get('parameters', {}).get('riskLevel', self.risk_level)
        self.trade_size = new_config.get('parameters', {}).get('tradeSize', self.trade_size)
        self.last_update = datetime.now().isoformat()

    async def get_wallet_balance(self) -> float:
        """Get current wallet balance"""
        try:
            return await self.wallet.get_balance()
        except Exception as e:
            return 0.0

    def get_status(self) -> Dict[str, Any]:
        """Get detailed trading status"""
        status = super().get_status()
        status.update({
            "strategy_type": self.strategy_type,
            "risk_level": self.risk_level,
            "trade_size": self.trade_size,
            "wallet_address": self.wallet.get_public_key()
        })
        return status
