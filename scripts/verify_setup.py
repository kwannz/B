import asyncio
import os
from datetime import datetime
import socket

import redis
from motor.motor_asyncio import AsyncIOMotorClient
from sqlalchemy import create_engine, text

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
        conn_str = f'postgresql://admin:tradingbot_local_dev@localhost:5432/tradingbot'
        engine = create_engine(conn_str)
        with engine.connect() as conn:
            conn.execute(text('SELECT 1'))
        print('PostgreSQL connection: OK')
    except Exception as e:
        print(f'PostgreSQL connection failed: {e}')

def test_port(port):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        result = sock.connect_ex(('localhost', port))
        if result == 0:
            print(f'Port {port} is open')
        else:
            print(f'Port {port} is closed')
    finally:
        sock.close()

async def main():
    print(f"\nSystem Verification Started at {datetime.now()}\n")
    
    print("Testing Database Connections:")
    print("-" * 30)
    await test_mongodb()
    test_redis()
    test_postgres()
    
    print("\nTesting Service Ports:")
    print("-" * 30)
    ports = [8000, 8001, 8002, 8003, 3000]
    for port in ports:
        test_port(port)

if __name__ == '__main__':
    asyncio.run(main())
