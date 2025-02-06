import os
import sys
import asyncio
import logging
import motor.motor_asyncio

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def init_db():
    try:
        client = motor.motor_asyncio.AsyncIOMotorClient(
            os.getenv("MONGODB_URL", "mongodb://localhost:27017"),
            serverSelectionTimeoutMS=5000
        )
        db = client.tradingbot
        
        # Create indexes
        logger.info("Creating indexes...")
        await db.positions.create_index("symbol")
        await db.trades.create_index("timestamp")
        await db.orders.create_index("symbol")
        await db.risk_metrics.create_index("timestamp")
        
        # Verify connection
        await client.admin.command('ping')
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise

def main():
    try:
        asyncio.run(init_db())
    except KeyboardInterrupt:
        logger.info("Database initialization interrupted")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
