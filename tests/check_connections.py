import asyncio
import logging
import motor.motor_asyncio
import psycopg2
import redis
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def check_mongodb():
    try:
        client = motor.motor_asyncio.AsyncIOMotorClient("mongodb://localhost:27017")
        await client.admin.command('ping')
        logger.info("MongoDB connection: SUCCESS")
    except Exception as e:
        logger.error(f"MongoDB connection failed: {e}")

def check_postgres():
    try:
        conn = psycopg2.connect(
            dbname="tradingbot",
            user="postgres",
            password="trading_postgres_pass_123",
            host="localhost",
            port="5432"
        )
        conn.close()
        logger.info("PostgreSQL connection: SUCCESS")
    except Exception as e:
        logger.error(f"PostgreSQL connection failed: {e}")

def check_redis():
    try:
        client = redis.Redis(host='localhost', port=6379, db=0)
        client.ping()
        logger.info("Redis connection: SUCCESS")
    except Exception as e:
        logger.error(f"Redis connection failed: {e}")

async def main():
    logger.info("=== Database Connection Check ===")
    await check_mongodb()
    check_postgres()
    check_redis()

if __name__ == "__main__":
    asyncio.run(main())
