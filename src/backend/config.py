from typing import List
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

def get_allowed_origins() -> List[str]:
    return ["http://localhost:3000", "http://localhost:5173"]

class Settings(BaseSettings):
    # Database settings
    POSTGRES_DB: str = Field(default="tradingbot")
    POSTGRES_USER: str = Field(default="postgres")
    POSTGRES_PASSWORD: str = Field(default="postgres")
    POSTGRES_HOST: str = Field(default="localhost")
    POSTGRES_PORT: int = Field(default=5432)
    MONGODB_URL: str = Field(default="mongodb://localhost:27017/tradingbot")

    # GMGN settings
    GMGN_API_URL: str = Field(default="https://api.gmgn.ai/v1")
    GMGN_WS_URL: str = Field(default="wss://api.gmgn.ai/v1/ws")
    GMGN_API_KEY: str = Field(default="")
    GMGN_NETWORK: str = Field(default="mainnet")
    GMGN_SOLANA_RPC: str = Field(default="https://api.mainnet-beta.solana.com")
    
    # PumpPortal settings (legacy)
    PUMP_API_URL: str = Field(default="https://pumpportal.fun/api")
    PUMP_WS_URL: str = Field(default="wss://pumpportal.fun/api/data")
    PUMP_API_KEY: str = Field(default="")
    
    # Solana wallet settings
    SOLANA_WALLET_KEY: str = Field(default="")
    SOLANA_COMMITMENT: str = Field(default="confirmed")
    SOLANA_MAX_RETRIES: int = Field(default=3)
    SOLANA_RETRY_DELAY: int = Field(default=1)
    SOLANA_TRANSACTION_TIMEOUT: int = Field(default=30)

    # Trading settings
    GMGN_MIN_TRADE_SIZE: float = Field(default=0.01)
    GMGN_MAX_TRADE_SIZE: float = Field(default=10.0)
    GMGN_MIN_PRICE_IMPACT: float = Field(default=0.001)
    GMGN_MAX_PRICE_IMPACT: float = Field(default=0.05)
    GMGN_SLIPPAGE_TOLERANCE: float = Field(default=0.01)
    GMGN_MAX_RETRIES: int = Field(default=3)
    GMGN_RETRY_DELAY: int = Field(default=1)

    # Server settings
    HOST: str = Field(default="0.0.0.0")
    PORT: int = Field(default=8000)
    DEBUG: bool = Field(default=False)

    # JWT settings
    JWT_SECRET: str = Field(default="your-secret-key-here")
    JWT_ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30)

    # CORS settings
    ALLOWED_ORIGINS: List[str] = Field(default_factory=get_allowed_origins)

    # WebSocket settings
    WS_PING_INTERVAL: int = Field(default=30000)
    WS_HEARTBEAT_TIMEOUT: int = Field(default=60000)

    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    model_config = SettingsConfigDict(env_file=".env")


# Create global settings instance
settings = Settings()
