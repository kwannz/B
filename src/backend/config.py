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
