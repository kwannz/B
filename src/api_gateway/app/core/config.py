from pydantic_settings import BaseSettings
from typing import Optional
from functools import lru_cache

class Settings(BaseSettings):
    model_config = {"env_file": ".env", "case_sensitive": True}
    
    PROJECT_NAME: str = "Trading Bot API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # JWT Settings
    JWT_SECRET_KEY: str = "devin_secure_jwt_key_2024"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days
    
    # Solana Settings
    SOLANA_NETWORK: str = "testnet"
    SOLANA_RPC_URL: str = "https://api.testnet.solana.com"
    TRADING_WALLET_ADDRESS: str = "Bmy8pkxSMLHTdaCop7urr7b4FPqs3QojVsGuC9Ly4vsU"
    TRADING_WALLET_PRIVATE_KEY: str = "29f8rVGdqnNAeJPffprmrPzbXnbuhTwRML4EeZYRsG3oyHcXnFpVvSxrC87s3YJy4UqRoYQSpCTNMpBH8q5VkzMx"
    
    # Database Settings
    POSTGRES_URL: str = "postgresql://ubuntu:tradingbot@localhost:5432/tradingbot"
    MONGODB_URL: str = "mongodb://localhost:27017/tradingbot"

@lru_cache()
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
