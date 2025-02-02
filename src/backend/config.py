import os
from typing import List
from pydantic_settings import BaseSettings
from pydantic import field_validator
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Settings(BaseSettings):
    # Database settings
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "tradingbot")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgres")
    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", "localhost")
    POSTGRES_PORT: int = int(os.getenv("POSTGRES_PORT", "5432"))

    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    # Server settings
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"

    # JWT settings
    JWT_SECRET: str = os.getenv("JWT_SECRET", "your-secret-key-here")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
    )

    # CORS settings
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://deploy-trading-app-tunnel-edift3yc.devinapps.com",
        "https://deploy-trading-app-tunnel-uv6t2aou.devinapps.com"
    ]

    # WebSocket settings
    WS_PING_INTERVAL: int = int(os.getenv("WS_PING_INTERVAL", "30000"))
    WS_HEARTBEAT_TIMEOUT: int = int(os.getenv("WS_HEARTBEAT_TIMEOUT", "60000"))

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "env_prefix": "",
        "extra": "allow"
    }


# Create global settings instance
settings = Settings()
