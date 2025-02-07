import asyncio
import json
import logging
from datetime import datetime
import websockets

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def monitor_general_websocket():
    async with websockets.connect('ws://localhost:8001/ws') as ws:
        logger.info("Connected to general WebSocket endpoint")
        while True:
            try:
                data = await ws.recv()
                metrics = json.loads(data)
                logger.info(f"General metrics update: {json.dumps(metrics, indent=2)}")
            except Exception as e:
                logger.error(f"Error in general WebSocket: {e}")
                break

async def monitor_trades_websocket():
    async with websockets.connect('ws://localhost:8001/ws/trades') as ws:
        logger.info("Connected to trades WebSocket endpoint")
        while True:
            try:
                data = await ws.recv()
                trade_data = json.loads(data)
                logger.info(f"Trade update: {json.dumps(trade_data, indent=2)}")
            except Exception as e:
                logger.error(f"Error in trades WebSocket: {e}")
                break

async def main():
    await asyncio.gather(
        monitor_general_websocket(),
        monitor_trades_websocket()
    )

if __name__ == "__main__":
    asyncio.run(main())
