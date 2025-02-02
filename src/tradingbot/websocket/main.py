from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
import asyncio
import json
from decimal import Decimal
from datetime import datetime

from tradingbot.api.core.deps import get_database, get_current_user
from tradingbot.api.models.user import User
from tradingbot.api.models.trading import Order, Position, Trade
from tradingbot.api.services.risk import RiskManagementService

app = FastAPI(title="TradingBot WebSocket Service")

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket

    def disconnect(self, client_id: str):
        self.active_connections.pop(client_id, None)

    async def broadcast(self, message: dict):
        for connection in self.active_connections.values():
            try:
                await connection.send_json(message)
            except WebSocketDisconnect:
                continue

manager = ConnectionManager()

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    client_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    await manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_json()
            
            # Process market data updates
            if data["type"] == "market_update":
                await manager.broadcast({
                    "type": "market_update",
                    "data": data["data"],
                    "timestamp": datetime.utcnow().isoformat()
                })
            
            # Process trade updates
            elif data["type"] == "trade_update":
                trade_data = data["data"]
                trade = Trade(**trade_data)
                await db.trades.insert_one(trade.model_dump())
                
                await manager.broadcast({
                    "type": "trade_update",
                    "data": trade.model_dump(),
                    "timestamp": datetime.utcnow().isoformat()
                })
            
            # Process position updates
            elif data["type"] == "position_update":
                position_data = data["data"]
                position = Position(**position_data)
                await db.positions.update_one(
                    {"_id": position.id},
                    {"$set": position.model_dump()}
                )
                
                await manager.broadcast({
                    "type": "position_update",
                    "data": position.model_dump(),
                    "timestamp": datetime.utcnow().isoformat()
                })
                
    except WebSocketDisconnect:
        manager.disconnect(client_id)
