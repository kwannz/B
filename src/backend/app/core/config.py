from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import PostgresDsn

class Settings(BaseSettings):
    # Auth settings
    JWT_SECRET: str = "your-secret-key-here"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_SECRET_KEY: str = "devin_secure_jwt_key_2024"
    
    # Database settings
    DATABASE_URL: PostgresDsn = "postgresql://tradingbot:tradingbot@postgres:5432/tradingbot"
    POSTGRES_URL: str | None = None
    MONGODB_URL: str | None = None
    
    # Trading settings
    TRADING_WALLET_ADDRESS: str | None = None
    TRADING_WALLET_PRIVATE_KEY: str | None = None

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env",
        env_file_encoding="utf-8",
        extra="allow"
    )

settings = Settings()
