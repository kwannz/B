"""
Market data background tasks
"""

import asyncio
import logging
from typing import List
from datetime import datetime

from ..services.market import MarketDataService
from ..core.exceptions import MarketDataError

logger = logging.getLogger(__name__)


class MarketDataUpdater:
    """Background task for updating market data cache."""

    def __init__(
        self,
        market_service: MarketDataService,
        symbols: List[str],
        update_interval: int = 5,  # seconds
    ):
        """Initialize market data updater."""
        self.market_service = market_service
        self.symbols = symbols
        self.update_interval = update_interval
        self.is_running = False
        self.last_update = None
        self.task = None

    async def start(self):
        """Start the market data updater."""
        if self.is_running:
            logger.warning("Market data updater is already running")
            return

        self.is_running = True
        self.task = asyncio.create_task(self._update_loop())
        logger.info("Started market data updater")

    async def stop(self):
        """Stop the market data updater."""
        if not self.is_running:
            logger.warning("Market data updater is not running")
            return

        self.is_running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        logger.info("Stopped market data updater")

    async def _update_loop(self):
        """Main update loop."""
        while self.is_running:
            try:
                await self._update_market_data()
                self.last_update = datetime.utcnow()
            except Exception as e:
                logger.error(f"Error updating market data: {str(e)}")

            await asyncio.sleep(self.update_interval)

    async def _update_market_data(self):
        """Update market data for all symbols."""
        tasks = []
        for symbol in self.symbols:
            task = asyncio.create_task(self._update_symbol_data(symbol))
            tasks.append(task)

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Log any errors
        for symbol, result in zip(self.symbols, results):
            if isinstance(result, Exception):
                logger.error(
                    f"Failed to update market data for {symbol}: {str(result)}"
                )

    async def _update_symbol_data(self, symbol: str):
        """Update market data for a single symbol."""
        try:
            await self.market_service.update_cache(symbol)
        except MarketDataError as e:
            logger.error(f"Market data error for {symbol}: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error updating {symbol}: {str(e)}")
            raise

    def get_status(self) -> dict:
        """Get the current status of the updater."""
        return {
            "is_running": self.is_running,
            "symbols": self.symbols,
            "update_interval": self.update_interval,
            "last_update": self.last_update.isoformat() if self.last_update else None,
        }
