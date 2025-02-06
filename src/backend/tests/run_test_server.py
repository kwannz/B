import os
import sys
import uvicorn
import asyncio
import logging
from pathlib import Path

# Add project root to Python path
project_root = str(Path(__file__).parent.parent.parent)
sys.path.insert(0, project_root)

from backend.main import app

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("uvicorn")

class TestServer(uvicorn.Server):
    def install_signal_handlers(self):
        pass

    @property
    def should_exit(self):
        return False

async def start_server():
    config = uvicorn.Config(
        app,
        host="127.0.0.1",
        port=8123,
        log_level="info",
        reload=False,
        workers=1,
        timeout_keep_alive=30,
        ws_ping_interval=None,
        ws_ping_timeout=None,
        loop="asyncio",
        log_config={
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "()": "uvicorn.logging.DefaultFormatter",
                    "fmt": "%(levelprefix)s %(message)s",
                    "use_colors": None,
                }
            },
            "handlers": {
                "default": {
                    "formatter": "default",
                    "class": "logging.StreamHandler",
                    "stream": "ext://sys.stdout",
                }
            },
            "loggers": {
                "uvicorn": {"handlers": ["default"], "level": "INFO"},
                "uvicorn.error": {"level": "INFO"},
                "uvicorn.access": {"handlers": ["default"], "level": "INFO", "propagate": False},
            },
        },
    )
    server = TestServer(config=config)
    await server.serve()

if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(start_server())
    finally:
        loop.close()
