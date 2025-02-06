from sqlalchemy import create_engine, text
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

async def test_connections():
    # Test PostgreSQL
    try:
        engine = create_engine('postgresql://postgres:postgres@localhost:5432/tradingbot')
        with engine.connect() as conn:
            result = conn.execute(text('SELECT COUNT(*) FROM users'))
            print("PostgreSQL connection successful")
            print(f"Users table exists with {result.scalar()} records")
    except Exception as e:
        print(f"PostgreSQL connection failed: {e}")

    # Test MongoDB
    try:
        client = AsyncIOMotorClient('mongodb://localhost:27017')
        db = client.tradingbot
        collections = await db.list_collection_names()
        print("MongoDB connection successful")
        print(f"Collections: {collections}")
    except Exception as e:
        print(f"MongoDB connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_connections())
