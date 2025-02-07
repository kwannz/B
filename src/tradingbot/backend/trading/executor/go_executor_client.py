import asyncio
from typing import Dict, Any

async def execute_trade_in_go(trade: Dict[str, Any]) -> Dict[str, Any]:
    # For test trade, simulate successful execution
    trade["status"] = "executed"
    trade["executed_price"] = 100.0  # Example price
    trade["executed_amount"] = trade["params"]["amount"]
    return trade
