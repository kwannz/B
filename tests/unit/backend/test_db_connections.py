import asyncio

import asyncpg
import motor.motor_asyncio
import redis.asyncio as redis


async def test_connections():
    # Test PostgreSQL
    try:
        conn = await asyncpg.connect(
            "postgresql://tradingbot:tradingbot@localhost/tradingbot"
        )
        await conn.execute("SELECT 1")
        print("PostgreSQL connection successful")
        await conn.close()
    except Exception as e:
        print(f"PostgreSQL connection failed: {e}")

    # Test MongoDB
    try:
        client = motor.motor_asyncio.AsyncIOMotorClient("mongodb://localhost:27017")
        await client.admin.command("ping")
        print("MongoDB connection successful")
        client.close()
    except Exception as e:
        print(f"MongoDB connection failed: {e}")

    # Test Redis
    try:
        redis_client = redis.from_url("redis://localhost:6379/0")
        await redis_client.ping()
        print("Redis connection successful")
        await redis_client.close()
    except Exception as e:
        print(f"Redis connection failed: {e}")


if __name__ == "__main__":
    asyncio.run(test_connections())
