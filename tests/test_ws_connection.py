import asyncio
import json
import logging
import os
import websockets

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_ws_connection():
    ws_url = os.getenv("HELIUS_WS_URL")
    if not ws_url:
        logger.error("HELIUS_WS_URL not set")
        return False
        
    try:
        async with websockets.connect(ws_url) as ws:
            await ws.send(json.dumps({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "logsSubscribe",
                "params": ["all", {"commitment": "confirmed"}]
            }))
            response = await asyncio.wait_for(ws.recv(), timeout=5)
            logger.info(f"WebSocket connection successful: {response}")
            return True
    except Exception as e:
        logger.error(f"WebSocket connection failed: {e}")
        return False

if __name__ == "__main__":
    asyncio.run(test_ws_connection())
