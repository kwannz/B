import logging
import os
from datetime import datetime

def setup_logging():
    """Configure logging for the trading bot."""
    # Create logs directory if it doesn't exist
    log_dir = os.path.dirname(os.path.abspath(__file__))
    os.makedirs(log_dir, exist_ok=True)
    
    # Configure root logger
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler('trading.log'),
            logging.FileHandler('monitor.log'),
            logging.FileHandler('multi_trades.log')
        ]
    )
    
    # Configure specific loggers
    loggers = {
        'tradingbot.backend': 'trading.log',
        'tradingbot.shared.exchange': 'multi_trades.log',
        'tradingbot.monitor': 'monitor.log',
        'tradingbot.websocket': 'monitor.log'
    }
    
    for logger_name, log_file in loggers.items():
        logger = logging.getLogger(logger_name)
        logger.setLevel(logging.INFO)
        handler = logging.FileHandler(log_file)
        handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
        logger.addHandler(handler)
