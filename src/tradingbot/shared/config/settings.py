from dataclasses import dataclass, field
from typing import Dict, Optional

@dataclass
class Settings:
    database_url: str = "sqlite:///./test.db"
    api_base_url: str = "http://localhost:8000"
    test_mode: bool = True
    log_level: str = "INFO"
    
    dex_settings: Dict[str, str] = field(default_factory=lambda: {
        "jupiter_api_url": "https://quote-api.jup.ag/v6",
        "raydium_api_url": "https://api.raydium.io/v2",
        "orca_api_url": "https://api.orca.so"
    })
    
    test_private_key: Optional[str] = None
    test_public_key: Optional[str] = None

settings = Settings()
