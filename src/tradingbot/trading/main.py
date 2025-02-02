from fastapi import FastAPI, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from tradingbot.api.core.deps import get_database, get_current_user
from tradingbot.api.models.user import User
from tradingbot.api.models.trading import Order, Position
from tradingbot.api.services.risk import RiskManagementService

app = FastAPI(title="TradingBot Trading Service")

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.post("/orders")
async def create_order(
    order: Order,
    user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    risk_service = RiskManagementService(db)
    risk_assessment = await risk_service.create_assessment(user.id, [], [order])
    
    if risk_assessment.risk_level == "HIGH":
        raise HTTPException(
            status_code=400,
            detail="Order rejected due to high risk assessment"
        )
    
    result = await db.orders.insert_one(order.model_dump())
    return {"order_id": str(result.inserted_id)}

@app.get("/positions")
async def get_positions(
    user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    cursor = db.positions.find({"user_id": user.id})
    positions = await cursor.to_list(length=100)
    return [Position(**position) for position in positions]
