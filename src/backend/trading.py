import os
import motor.motor_asyncio
from fastapi import FastAPI, WebSocket
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.mongo_client = motor.motor_asyncio.AsyncIOMotorClient(os.getenv("MONGODB_URL", "mongodb://localhost:27017"))
    app.state.db = app.state.mongo_client.tradingbot
    yield
    app.state.mongo_client.close()

app = FastAPI(lifespan=lifespan)

@app.get("/api/v1/positions")
async def get_positions():
    try:
        positions = await app.state.db.positions.find().to_list(None)
        return {"positions": [{"symbol": p["symbol"], "size": float(p["size"]), "entry_price": float(p["entry_price"])} for p in positions]}
    except Exception as e:
        return {"error": "Database error", "detail": str(e)}

@app.get("/api/v1/orders")
async def get_orders():
    try:
        orders = await app.state.db.orders.find().to_list(None)
        return {"orders": [{"symbol": o["symbol"], "side": o["side"], "size": float(o["size"]), "price": float(o["price"])} for o in orders]}
    except Exception as e:
        return {"error": "Database error", "detail": str(e)}

@app.get("/api/v1/trades")
async def get_trades():
    try:
        trades = await app.state.db.trades.find().to_list(None)
        return {"trades": [{"symbol": t["symbol"], "side": t["side"], "size": float(t["size"]), "price": float(t["price"])} for t in trades]}
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
