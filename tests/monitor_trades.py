import asyncio
import aiohttp
import json
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def fetch_metrics(session, url):
    try:
        async with session.get(url) as response:
            return await response.json()
    except Exception as e:
        logger.error(f'Error fetching metrics from {url}: {e}')
        return None

async def monitor_trades():
    async with aiohttp.ClientSession() as session:
        while True:
            try:
                trades = await fetch_metrics(session, 'http://localhost:8002/api/v1/trades')
                positions = await fetch_metrics(session, 'http://localhost:8002/api/v1/positions')
                risk = await fetch_metrics(session, 'http://localhost:8002/api/v1/risk/metrics')
                
                logger.info(f'=== Trade Execution Report [{datetime.utcnow().isoformat()}] ===')
                
                if trades and 'trades' in trades:
                    logger.info(f'Active Trades: {len(trades["trades"])}')
                    for trade in trades["trades"]:
                        logger.info(f'Trade: {trade["symbol"]} Side: {trade["side"]} Size: {trade["size"]} Price: {trade["price"]}')
                
                if positions and 'positions' in positions:
                    logger.info(f'Active Positions: {len(positions["positions"])}')
                    for pos in positions["positions"]:
                        logger.info(f'Position: {pos["symbol"]} Size: {pos["size"]} Entry: {pos["entry_price"]}')
                
                if risk and not isinstance(risk, dict):
                    logger.info('Risk Metrics:')
                    logger.info(f'Total Exposure: {risk.get("total_exposure", 0)}')
                    logger.info(f'Margin Used: {risk.get("margin_used", 0)}')
                    logger.info(f'Daily PnL: {risk.get("daily_pnl", 0)}')
                
                logger.info('=== End Report ===\n')
                await asyncio.sleep(5)
            except Exception as e:
                logger.error(f'Monitoring error: {e}')
                await asyncio.sleep(5)

if __name__ == '__main__':
    asyncio.run(monitor_trades())
