import os
from datetime import datetime
import motor.motor_asyncio
from fastapi import FastAPI, WebSocket, HTTPException
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        app.state.mongo_client = motor.motor_asyncio.AsyncIOMotorClient(
            os.getenv("MONGODB_URL", "mongodb://localhost:27017"),
            serverSelectionTimeoutMS=5000
        )
        # Test connection
        await app.state.mongo_client.admin.command('ping')
        app.state.db = app.state.mongo_client.tradingbot
        # Initialize collections if they don't exist
        await app.state.db.positions.create_index("symbol")
        await app.state.db.trades.create_index("timestamp")
        await app.state.db.orders.create_index("symbol")
        yield
    except Exception as e:
        print(f"MongoDB connection error: {e}")
        raise
    finally:
        if hasattr(app.state, 'mongo_client'):
            app.state.mongo_client.close()

app = FastAPI(lifespan=lifespan)

@app.get("/api/v1/health")
async def health_check():
    try:
        # Test MongoDB connection
        await app.state.db.command("ping")
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "database": "connected"
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")

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
            if "type" in data:
                if data["type"] == "trade":
                    await app.state.db.trades.insert_one({
                        "symbol": data["symbol"],
                        "side": data["side"],
                        "size": float(data["size"]),
                        "price": float(data["price"]),
                        "timestamp": datetime.utcnow()
                    })
                elif data["type"] == "position":
                    await app.state.db.positions.insert_one({
                        "symbol": data["symbol"],
                        "size": float(data["size"]),
                        "entry_price": float(data["entry_price"]),
                        "current_price": float(data["current_price"]),
                        "unrealized_pnl": float(data["unrealized_pnl"]),
                        "timestamp": datetime.utcnow()
                    })
            await websocket.send_json({"status": "received", "timestamp": datetime.utcnow().isoformat()})
    except Exception as e:
        print(f"WebSocket error: {e}")
        await websocket.close()
