import os
from dataclasses import dataclass, field
from typing import Dict, Optional

@dataclass
class Settings:
    # Database Configuration
    database_url: str = "postgresql://postgres:postgres@localhost:5432/tradingbot"
    mongodb_url: str = "mongodb://localhost:27017/tradingbot"
    redis_url: str = "redis://localhost:6379/0"
    
    # API Configuration
    api_base_url: str = "http://localhost:8000"
    api_timeout: int = 30
    retry_attempts: int = 3
    retry_delay: int = 1
    log_level: str = "INFO"
    
    # DEX Configuration
    dex_settings: Dict[str, str] = field(default_factory=lambda: {
        "jupiter_api_url": "https://quote-api.jup.ag/v6",
        "raydium_api_url": "https://api.raydium.io/v2",
        "orca_api_url": "https://api.orca.so",
        "primary_dex": "jupiter"
    })
    
    # Trading Configuration
    wallet_key: str = field(default_factory=lambda: os.getenv("SOLANA_WALLET_KEY", ""))
    max_trade_size_sol: float = field(default_factory=lambda: float(os.getenv("MAX_TRADE_SIZE_SOL", "10.0")))
    risk_management_enabled: bool = field(default_factory=lambda: os.getenv("RISK_MANAGEMENT_ENABLED", "true").lower() == "true")
    risk_level: str = field(default_factory=lambda: os.getenv("RISK_LEVEL", "medium"))
    test_mode: bool = field(default_factory=lambda: os.getenv("TEST_MODE", "false").lower() == "true")

settings = Settings()
