import asyncio
import logging
import json
import websockets
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('multi_trades.log')
    ]
)
logger = logging.getLogger(__name__)

async def monitor_trades():
    async with websockets.connect('ws://localhost:8001/ws/multi_trades') as ws:
        logger.info("Connected to multi-trades WebSocket")
        while True:
            try:
                data = await ws.recv()
                trades = json.loads(data)
                
                # Log trade updates
                if "trades" in trades:
                    for trade in trades["trades"]:
                        if trade["status"] == "executed":
                            logger.info(f"Successful trade: {trade}")
                        elif trade["status"] == "failed":
                            logger.warning(f"Failed trade: {trade}")
                        else:
                            logger.info(f"Trade update: {trade}")
                            
                # Log statistics
                if "total_trades" in trades:
                    logger.info(
                        f"Trade stats - Total: {trades['total_trades']}, "
                        f"Successful: {trades['successful_trades']}, "
                        f"Failed: {trades['failed_trades']}"
                    )
                    
            except websockets.exceptions.ConnectionClosed:
                logger.error("WebSocket connection closed")
                break
            except Exception as e:
                logger.error(f"Error monitoring trades: {e}")
                await asyncio.sleep(5)
                continue

if __name__ == "__main__":
    try:
        asyncio.run(monitor_trades())
    except KeyboardInterrupt:
        logger.info("Monitoring stopped by user")
    except Exception as e:
        logger.error(f"Monitoring error: {e}")
