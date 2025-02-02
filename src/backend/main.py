from fastapi import FastAPI, HTTPException, Depends, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from database import (
    get_db, Signal, Trade, Strategy, Agent, init_db, init_mongodb,
    TradeStatus, StrategyStatus, AgentStatus, mongodb, async_mongodb
)
from schemas import MarketData
from tradingbot.shared.models.ollama import OllamaModel
import logging

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)
from schemas import (
    SignalCreate,
    SignalResponse,
    SignalListResponse,
    TradeCreate,
    TradeResponse,
    TradeListResponse,
    StrategyCreate,
    StrategyResponse,
    StrategyListResponse,
    AgentResponse,
    PerformanceResponse,
)
from websocket import (
    handle_websocket_connection,
    broadcast_trade_update,
    broadcast_signal,
    broadcast_performance_update,
    broadcast_agent_status,
)
app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Initialize databases
@app.on_event("startup")
async def startup_event():
    init_db()  # Initialize PostgreSQL
    init_mongodb()  # Initialize MongoDB collections


# Market Analysis endpoint
@app.post("/api/v1/analysis")
async def analyze_market(market_data: MarketData):
    try:
        logger.info(f"Received market data for analysis: {market_data.symbol}")
        model = OllamaModel()
        analysis_request = {
            "symbol": market_data.symbol,
            "price": market_data.price,
            "volume": market_data.volume,
            "indicators": market_data.metadata.get("indicators", {})
        }
        logger.info(f"Sending analysis request: {analysis_request}")
        analysis = await model.analyze_market(analysis_request)
        logger.info(f"Analysis completed successfully")
        return {
            "status": "success",
            "data": analysis,
            "timestamp": datetime.utcnow().isoformat()
        }

        # Initialize and verify Ollama model
        try:
            model = OllamaModel()
            analysis_request = {
                "symbol": market_data.symbol,
                "price": market_data.price,
                "volume": market_data.volume,
                "indicators": market_data.metadata.get("indicators", {})
            }
            print(f"Sending analysis request: {analysis_request}")
            analysis = await model.analyze_market(analysis_request)
            print(f"Received analysis response: {analysis}")
        except Exception as model_err:
            print(f"Model error: {model_err}")
            raise HTTPException(
                status_code=500,
                detail="Model analysis failed"
            )

        # Store data in MongoDB
        try:
            await async_mongodb.market_snapshots.insert_one(market_data.dict())
            await async_mongodb.technical_analysis.insert_one({
                "symbol": market_data.symbol,
                "timestamp": datetime.utcnow(),
                "analysis": analysis,
                "market_data": market_data.dict()
            })
        except Exception as store_err:
            print(f"Storage error: {store_err}")
            # Continue even if storage fails
            pass

        return analysis
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Health check endpoint
@app.get("/api/v1/health")
async def health_check():
    try:
        # Test database connection
        from sqlalchemy import text
        db = next(get_db())
        db.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "database": "connected",
            "version": "1.0.0",
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")


# WebSocket endpoints
@app.websocket("/ws/trades")
async def websocket_trades(websocket: WebSocket):
    await handle_websocket_connection(websocket, "trades")


@app.websocket("/ws/signals")
async def websocket_signals(websocket: WebSocket):
    await handle_websocket_connection(websocket, "signals")


@app.websocket("/ws/performance")
async def websocket_performance(websocket: WebSocket):
    await handle_websocket_connection(websocket, "performance")


@app.websocket("/ws/agent_status")
async def websocket_agent_status(websocket: WebSocket):
    await handle_websocket_connection(websocket, "agent_status")


@app.websocket("/ws/analysis")
async def websocket_analysis(websocket: WebSocket):
    await handle_websocket_connection(websocket, "analysis")


# REST endpoints
@app.get("/api/v1/strategies", response_model=StrategyListResponse)
async def get_strategies(db: Session = Depends(get_db)):
    strategies = db.query(Strategy).all()
    return StrategyListResponse(strategies=strategies)


@app.post("/api/v1/strategies", response_model=StrategyResponse)
async def create_strategy(strategy: StrategyCreate, db: Session = Depends(get_db)):
    db_strategy = Strategy(**strategy.model_dump())
    db.add(db_strategy)
    db.commit()
    db.refresh(db_strategy)
    return db_strategy


@app.get("/api/v1/agents/{agent_type}/status", response_model=AgentResponse)
async def get_agent_status(agent_type: str, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.type == agent_type).first()
    if not agent:
        agent = Agent(type=agent_type, status=AgentStatus.STOPPED)
        db.add(agent)
        db.commit()
        db.refresh(agent)
    return agent


@app.post("/api/v1/agents/{agent_type}/start", response_model=AgentResponse)
async def start_agent(agent_type: str, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.type == agent_type).first()
    if not agent:
        agent = Agent(type=agent_type)
        db.add(agent)
    agent.status = AgentStatus.RUNNING
    agent.last_updated = datetime.utcnow()
    db.commit()
    db.refresh(agent)

    # Broadcast agent status update
    await broadcast_agent_status(agent_type, "running")
    return agent


@app.post("/api/v1/agents/{agent_type}/stop", response_model=AgentResponse)
async def stop_agent(agent_type: str, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.type == agent_type).first()
    if not agent:
        agent = Agent(type=agent_type)
        db.add(agent)
    agent.status = AgentStatus.STOPPED
    agent.last_updated = datetime.utcnow()
    db.commit()
    db.refresh(agent)

    # Broadcast agent status update
    await broadcast_agent_status(agent_type, "stopped")
    return agent


@app.get("/api/v1/trades", response_model=TradeListResponse)
async def get_trades(db: Session = Depends(get_db)):
    trades = db.query(Trade).all()
    return TradeListResponse(trades=trades)


@app.post("/api/v1/trades", response_model=TradeResponse)
async def create_trade(trade: TradeCreate, db: Session = Depends(get_db)):
    db_trade = Trade(**trade.model_dump())
    db.add(db_trade)
    db.commit()
    db.refresh(db_trade)

    # Broadcast trade update
    await broadcast_trade_update(db_trade.model_dump())
    return db_trade


@app.get("/api/v1/signals", response_model=SignalListResponse)
async def get_signals(db: Session = Depends(get_db)):
    signals = db.query(Signal).all()
    return SignalListResponse(signals=signals)


@app.post("/api/v1/signals", response_model=SignalResponse)
async def create_signal(signal: SignalCreate, db: Session = Depends(get_db)):
    db_signal = Signal(**signal.model_dump())
    db.add(db_signal)
    db.commit()
    db.refresh(db_signal)

    # Broadcast signal
    await broadcast_signal(db_signal.model_dump())
    return db_signal


@app.get("/api/v1/performance", response_model=PerformanceResponse)
async def get_performance(db: Session = Depends(get_db)):
    try:
        # Calculate performance metrics from trades
        trades = db.query(Trade).all()
        total_trades = len(trades)
        if total_trades == 0:
            performance_data = {
                "total_trades": 0,
                "profitable_trades": 0,
                "total_profit": 0,
                "win_rate": 0,
                "average_profit": 0,
                "max_drawdown": 0,
            }
            await broadcast_performance_update(performance_data)
            return PerformanceResponse(**performance_data)

        profitable_trades = 0
        total_profit = 0
        profits = []

        for trade in trades:
            if trade.status == TradeStatus.CLOSED:
                profit = 0
                if trade.direction == "long":
                    profit = (trade.exit_price - trade.entry_price) * trade.quantity
                else:  # short
                    profit = (trade.entry_price - trade.exit_price) * trade.quantity

                if profit > 0:
                    profitable_trades += 1
                total_profit += profit
                profits.append(profit)

        closed_trades = len([t for t in trades if t.status == TradeStatus.CLOSED])
        win_rate = profitable_trades / closed_trades if closed_trades > 0 else 0
        average_profit = total_profit / closed_trades if closed_trades > 0 else 0

        # Calculate max drawdown
        max_drawdown = 0
        peak = 0
        for profit in profits:
            peak = max(peak, profit)
            drawdown = peak - profit
            max_drawdown = max(max_drawdown, drawdown)

        performance_data = {
            "total_trades": total_trades,
            "profitable_trades": profitable_trades,
            "total_profit": total_profit,
            "win_rate": win_rate,
            "average_profit": average_profit,
            "max_drawdown": max_drawdown,
        }

        # Broadcast performance update
        await broadcast_performance_update(performance_data)
        return PerformanceResponse(**performance_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
