from datetime import datetime
from decimal import Decimal
from typing import Dict, Optional

class Wallet:
    def __init__(
        self,
        wallet_id: str,
        balances: Optional[Dict[str, Decimal]] = None,
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None
    ):
        self.wallet_id = wallet_id
        self.balances = balances or {}
        self.created_at = created_at or datetime.utcnow()
        self.updated_at = updated_at or datetime.utcnow()

    def update_balance(self, asset: str, amount: Decimal):
        self.balances[asset] = amount
        self.updated_at = datetime.utcnow()

    def get_balance(self, asset: str) -> Decimal:
        return self.balances.get(asset, Decimal('0'))
