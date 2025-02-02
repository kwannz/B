import sys
import os
import asyncio
import redis
from motor.motor_asyncio import AsyncIOMotorClient
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv("config/.env")

async def test_mongodb():
    try:
        client = AsyncIOMotorClient('mongodb://localhost:27017')
        await client.admin.command('ping')
        print('MongoDB connection: OK')
    except Exception as e:
        print(f'MongoDB connection failed: {e}')

def test_redis():
    try:
        r = redis.Redis(host='localhost', port=6379)
        r.ping()
        print('Redis connection: OK')
    except Exception as e:
        print(f'Redis connection failed: {e}')

def test_postgres():
    try:
        engine = create_engine(f'postgresql://{os.getenv("POSTGRES_USER")}:{os.getenv("POSTGRES_PASSWORD")}@{os.getenv("POSTGRES_HOST")}:{os.getenv("POSTGRES_PORT")}/{os.getenv("POSTGRES_DB")}')
        with engine.connect() as conn:
            conn.execute(text('SELECT 1'))
        print('PostgreSQL connection: OK')
    except Exception as e:
        print(f'PostgreSQL connection failed: {e}')

async def main():
    print(f'Python {sys.version}\n')
    print('Testing database connections...')
    await test_mongodb()
    test_redis()
    test_postgres()

if __name__ == '__main__':
    asyncio.run(main())
