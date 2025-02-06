import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi import FastAPI, WebSocket
import asyncio
from datetime import datetime
from src.tradingbot.api.core.deps import get_db
from src.tradingbot.api.models.trading import Position
from src.tradingbot.api.models.risk import RiskMetrics
from sqlalchemy.orm import Session
from fastapi import Depends

app = FastAPI()

@app.get("/api/v1/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, db: Session = Depends(get_db)):
    await websocket.accept()
    try:
        while True:
            # Get positions
            positions = db.query(Position).all()
            position_data = [
                {
                    "symbol": p.symbol,
                    "size": float(p.size),
                    "entry_price": float(p.entry_price),
                    "current_price": float(p.current_price),
                    "unrealized_pnl": float(p.unrealized_pnl)
                } for p in positions
            ]

            # Get risk metrics
            risk_metrics = db.query(RiskMetrics).first()
            metrics_data = {
                "total_exposure": float(risk_metrics.total_exposure) if risk_metrics else 0,
                "margin_used": float(risk_metrics.margin_used) if risk_metrics else 0,
                "daily_pnl": float(risk_metrics.daily_pnl) if risk_metrics else 0
            }

            await websocket.send_json({
                "timestamp": datetime.utcnow().isoformat(),
                "metrics": {
                    "active_tokens": len(positions),
                    "positions": position_data,
                    "risk_metrics": metrics_data
                }
            })
            await asyncio.sleep(5)
    except Exception:
        await websocket.close()
