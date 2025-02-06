import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi import FastAPI, WebSocket, Depends
from src.tradingbot.api.core.deps import get_db
from src.tradingbot.api.models.trading import Order, Position
from src.tradingbot.api.models.trade import Trade
from sqlalchemy.orm import Session

app = FastAPI()

@app.on_event("startup")
async def startup_event():
    pass

from sqlalchemy import select

@app.get("/api/v1/positions")
async def get_positions(db: Session = Depends(get_db)):
    try:
        stmt = select(Position)
        result = db.execute(stmt)
        positions = result.scalars().all()
        return {"positions": [{"symbol": p.symbol, "size": float(p.size), "entry_price": float(p.entry_price)} for p in positions]}
    except Exception as e:
        return {"error": "Database error", "detail": str(e)}

@app.get("/api/v1/orders")
async def get_orders(db: Session = Depends(get_db)):
    try:
        stmt = select(Order)
        result = db.execute(stmt)
        orders = result.scalars().all()
        return {"orders": [{"symbol": o.symbol, "side": o.side, "size": float(o.size), "price": float(o.price)} for o in orders]}
    except Exception as e:
        return {"error": "Database error", "detail": str(e)}

@app.get("/api/v1/trades")
async def get_trades(db: Session = Depends(get_db)):
    try:
        stmt = select(Trade)
        result = db.execute(stmt)
        trades = result.scalars().all()
        return {"trades": [{"symbol": t.symbol, "side": t.side, "size": float(t.size), "price": float(t.price)} for t in trades]}
    except Exception as e:
        return {"error": "Database error", "detail": str(e)}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            # Process trading data
            await websocket.send_json({"status": "received"})
    except Exception:
        await websocket.close()
