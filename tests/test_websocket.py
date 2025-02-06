import asyncio
import websockets
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_websocket():
    uri = "ws://localhost:8001/ws"
    async with websockets.connect(uri) as websocket:
        logger.info("Connected to WebSocket")
        try:
            while True:
                message = await websocket.recv()
                data = json.loads(message)
                logger.info("Received metrics:")
                logger.info(json.dumps(data, indent=2))
        except websockets.exceptions.ConnectionClosed:
            logger.error("WebSocket connection closed")

if __name__ == "__main__":
    asyncio.run(test_websocket())
