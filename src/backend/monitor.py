import os
import asyncio
import logging
from datetime import datetime
import motor.motor_asyncio
from fastapi import FastAPI, WebSocket, HTTPException, BackgroundTasks
from pymongo import MongoClient
from tradingbot.shared.exchange.jupiter_client import JupiterClient
from tradingbot.shared.exchange.price_aggregator import PriceAggregator

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

app = FastAPI()

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

async def monitor_price_metrics():
    while True:
        try:
            # Get price data for SOL/USDC pair
            price_data = await app.state.price_aggregator.get_aggregated_price(
                token_in="So11111111111111111111111111111111111111112",  # SOL
                token_out="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  # USDC
                amount=0.1  # Small amount for price check
            )
            
            price_metrics = {
                "timestamp": datetime.utcnow(),
                "jupiter_price": price_data.get("price", 0),
                "solscan_price": price_data.get("validation_price", 0),
                "price_diff": price_data.get("price_diff", 0),
                "circuit_breaker_status": "triggered" if "Circuit breaker triggered" in price_data.get("error", "") else "normal",
                "last_check": datetime.utcnow().isoformat()
            }
            
            await app.state.db.metrics.update_one(
                {"type": "price_metrics"},
                {"$set": price_metrics},
                upsert=True
            )
            
            # Log validation results
            if price_metrics["circuit_breaker_status"] == "triggered":
                logger.warning(f"Circuit breaker triggered - Price difference: {price_metrics['price_diff']:.2%}")
            elif price_metrics["price_diff"] > 0.05:
                logger.warning(f"Large price difference detected: {price_metrics['price_diff']:.2%}")
                
            await asyncio.sleep(60)  # Check every minute
        except Exception as e:
            logger.error(f"Error monitoring price metrics: {e}")
            await asyncio.sleep(30)

async def monitor_jupiter_metrics():
    while True:
        try:
            metrics = await app.state.db.metrics.find_one({"type": "price_metrics"})
            jupiter_metrics = {
                "timestamp": datetime.utcnow(),
                "trades": await app.state.db.trades.find().sort("timestamp", -1).limit(10).to_list(None),
                "wallet_balance": await app.state.db.wallet.find_one({"type": "balance"}),
                "risk_metrics": await app.state.db.risk_metrics.find_one(),
                "price_metrics": metrics if metrics else {}
            }
            await app.state.db.metrics.update_one(
                {"type": "jupiter_metrics"},
                {"$set": jupiter_metrics},
                upsert=True
            )
            await asyncio.sleep(60)
        except Exception as e:
            logger.error(f"Error monitoring Jupiter metrics: {e}")
            await asyncio.sleep(30)

@app.on_event("startup")
async def startup_event():
    try:
        logger.info("Initializing MongoDB connection...")
        app.state.mongo_client = motor.motor_asyncio.AsyncIOMotorClient(
            os.getenv("MONGODB_URL", "mongodb://localhost:27017"),
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            socketTimeoutMS=5000
        )
        logger.info("Testing MongoDB connection...")
        await app.state.mongo_client.admin.command('ping')
        app.state.db = app.state.mongo_client.tradingbot
        logger.info("Initializing collections and indexes...")
        await app.state.db.positions.create_index("symbol")
        await app.state.db.risk_metrics.create_index("timestamp")
        await app.state.db.metrics.create_index([("type", 1), ("timestamp", -1)])
        
        # Initialize price aggregator for monitoring
        app.state.price_aggregator = PriceAggregator({
            "jupiter": {
                "slippage_bps": 200,
                "retry_count": 3,
                "retry_delay": 1000
            },
            "solscan": {
                "api_key": os.getenv("SOLSCAN_API_KEY")
            },
            "max_price_diff": 0.05,
            "circuit_breaker": 0.10
        })
        await app.state.price_aggregator.start()
        
        # Start monitoring tasks
        background_tasks = BackgroundTasks()
        background_tasks.add_task(monitor_jupiter_metrics)
        background_tasks.add_task(monitor_price_metrics)
        
        logger.info("MongoDB and monitoring initialization complete")
    except Exception as e:
        logger.error(f"Initialization error: {e}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    if hasattr(app.state, 'price_aggregator'):
        await app.state.price_aggregator.stop()
    if hasattr(app.state, 'mongo_client'):
        app.state.mongo_client.close()

@app.get("/api/v1/health")
async def health_check():
    try:
        await app.state.db.command("ping")
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "database": "connected"
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")

@app.get("/api/v1/price-metrics")
async def get_price_metrics():
    try:
        metrics = await app.state.db.metrics.find_one({"type": "price_metrics"})
        if not metrics:
            return {"error": "No price metrics available"}
        return {
            "timestamp": metrics["timestamp"].isoformat(),
            "jupiter_price": metrics["jupiter_price"],
            "solscan_price": metrics["solscan_price"],
            "price_diff": metrics["price_diff"],
            "circuit_breaker_status": metrics["circuit_breaker_status"],
            "last_check": metrics["last_check"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            try:
                # Get latest trade data
                trades = await app.state.db.trades.find().sort("timestamp", -1).limit(10).to_list(None)
                trade_data = [
                    {
                        "symbol": t["symbol"],
                        "side": t["side"],
                        "size": float(t["size"]),
                        "price": float(t["price"]),
                        "timestamp": t["timestamp"].isoformat()
                    } for t in trades
                ] if trades else []

                # Get risk metrics
                risk_metrics = await app.state.db.risk_metrics.find_one()
                metrics_data = {
                    "total_exposure": float(risk_metrics.get("total_exposure", 0)) if risk_metrics else 0,
                    "margin_used": float(risk_metrics.get("margin_used", 0)) if risk_metrics else 0,
                    "daily_pnl": float(risk_metrics.get("daily_pnl", 0)) if risk_metrics else 0
                }

                # Get price metrics
                price_metrics = await app.state.db.metrics.find_one({"type": "price_metrics"})
                price_data = {
                    "jupiter_price": price_metrics.get("jupiter_price", 0),
                    "solscan_price": price_metrics.get("solscan_price", 0),
                    "price_diff": price_metrics.get("price_diff", 0),
                    "circuit_breaker_status": price_metrics.get("circuit_breaker_status", "normal"),
                    "last_check": price_metrics.get("last_check", datetime.utcnow().isoformat())
                } if price_metrics else {}

                # Get wallet balance
                wallet_data = await app.state.db.wallet.find_one({"type": "balance"})
                balance_data = {
                    "balance": float(wallet_data.get("balance", 0)) if wallet_data else 0,
                    "timestamp": wallet_data.get("timestamp", datetime.utcnow()).isoformat() if wallet_data else datetime.utcnow().isoformat()
                }

                await websocket.send_json({
                    "timestamp": datetime.utcnow().isoformat(),
                    "metrics": {
                        "trades": trade_data,
                        "risk_metrics": metrics_data,
                        "price_metrics": price_data,
                        "wallet": balance_data
                    }
                })
            except Exception as e:
                logger.error(f"Error collecting metrics: {e}")
                await websocket.send_json({
                    "timestamp": datetime.utcnow().isoformat(),
                    "metrics": {"error": str(e)}
                })
            await asyncio.sleep(5)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        await websocket.close()
