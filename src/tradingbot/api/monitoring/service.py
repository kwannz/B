import asyncio
import psutil
from datetime import datetime
import logging
from prometheus_client import start_http_server
from typing import Optional

from .config import monitoring_config
from .metrics import (
    update_system_metrics,
    update_market_metrics,
    update_risk_metrics,
    TRADE_COUNT,
    TRADE_VOLUME
)
logger = logging.getLogger(__name__)

class MonitoringService:
    def __init__(self):
        self._running = False
        self.dex_client = None
        self._task = None

    async def initialize(self):
        """Initialize DEX client."""
        if not self.dex_client:
            from ...shared.exchange.dex_client import DEXClient
            self.dex_client = DEXClient()
            await self.dex_client.start()
        
    async def start(self):
        """Start the monitoring service."""
        if self._running:
            return
            
        try:
            # Start Prometheus metrics server
            start_http_server(monitoring_config.prometheus_port)
            logger.info(f"Prometheus metrics server started on port {monitoring_config.prometheus_port}")
            
            self._running = True
            self._task = asyncio.create_task(self._monitoring_loop())
            logger.info("Monitoring service started")
        except Exception as e:
            logger.error(f"Failed to start monitoring service: {e}")
            raise
    
    async def stop(self):
        """Stop the monitoring service."""
        if not self._running:
            return
            
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Monitoring service stopped")
    
    async def _monitoring_loop(self):
        """Main monitoring loop."""
        while self._running:
            try:
                # Update system metrics
                process = psutil.Process()
                memory_info = process.memory_info()
                cpu_percent = process.cpu_percent()
                
                update_system_metrics(
                    memory_bytes=memory_info.rss,
                    cpu_percent=cpu_percent
                )
                
                # Update market metrics for active markets
                markets = ["SOL/USDC", "BONK/SOL", "JUP/SOL"]
                for market in markets:
                    market_data = {"error": "No DEX client"}
                    if self.dex_client:
                        market_data = await self.dex_client.get_market_data("gmgn")
                    if "error" not in market_data:
                        price = float(market_data.get("price", 0))
                        volume = float(market_data.get("volume_24h", 0))
                        update_market_metrics(
                            market=market,
                            price=price,
                            volume=volume
                        )
                
                logger.debug("Metrics updated successfully")
            except Exception as e:
                logger.error(f"Error updating metrics: {e}")
            
            await asyncio.sleep(monitoring_config.collection_interval)

monitoring_service = MonitoringService()
