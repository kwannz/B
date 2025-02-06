import asyncio
import psutil
from datetime import datetime
import logging
from prometheus_client import start_http_server, make_wsgi_app
from typing import Optional
import threading

from .config import monitoring_config
from .server import start_metrics_server
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
        self._server_thread = None
        self._loop = None
        self._db = None
        self._redis = None

    @property
    def db(self):
        return self._db

    @db.setter
    def db(self, value):
        self._db = value

    @property
    def redis(self):
        return self._redis

    @redis.setter
    def redis(self, value):
        self._redis = value

    @property
    def loop(self):
        return self._loop

    @loop.setter
    def loop(self, value):
        self._loop = value

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
            if self.db is None or self.redis is None:
                raise RuntimeError("Database and Redis must be initialized before starting")

            # Start Prometheus metrics server with socket reuse
            app = make_wsgi_app()
            self._server_thread = threading.Thread(
                target=start_metrics_server,
                args=(monitoring_config.prometheus_port, app),
                daemon=True
            )
            self._server_thread.start()
            logger.info(f"Prometheus metrics server started on port {monitoring_config.prometheus_port}")
            
            self._running = True
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            self._loop = loop
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
        if self._task and not self._task.done():
            try:
                self._task.cancel()
                try:
                    loop = asyncio.get_running_loop()
                except RuntimeError:
                    loop = self._loop or asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                await asyncio.shield(asyncio.wait_for(self._task, timeout=1.0))
            except (asyncio.TimeoutError, asyncio.CancelledError):
                pass
            except Exception as e:
                logger.error(f"Error stopping monitoring service: {e}")
            finally:
                self._task = None
                self._loop = None
        logger.info("Monitoring service stopped")

    def is_running(self) -> bool:
        """Check if the monitoring service is running."""
        return self._running
    
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
