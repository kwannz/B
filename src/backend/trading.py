from fastapi import FastAPI, WebSocket, Depends
from tradingbot.api.core.deps import get_db
from tradingbot.api.models.trading import Order, Position
from tradingbot.api.models.trade import Trade
from sqlalchemy.orm import Session

app = FastAPI()

@app.on_event("startup")
async def startup_event():
    pass

@app.get("/api/v1/positions")
async def get_positions(db: Session = Depends(get_db)):
    return db.query(Position).all()

@app.get("/api/v1/orders")
async def get_orders(db: Session = Depends(get_db)):
    return db.query(Order).all()

@app.get("/api/v1/trades")
async def get_trades(db: Session = Depends(get_db)):
    return db.query(Trade).all()

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
