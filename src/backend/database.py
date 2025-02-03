"""Database models and connection management."""

from __future__ import annotations

import enum
from datetime import datetime
from typing import Any, Dict, Generator, Optional, Type, TypeVar, cast

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient
from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    Enum,
    Float,
    Integer,
    String,
    create_engine,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session, sessionmaker

from config import settings

# Create SQLAlchemy engine with configured DATABASE_URL
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Define a type variable for SQLAlchemy models
ModelType = TypeVar("ModelType", bound=Any)
T = TypeVar("T", bound=Any)

mongodb_client = MongoClient(settings.MONGODB_URL)
mongodb = mongodb_client.get_database()

async_mongodb_client = AsyncIOMotorClient(settings.MONGODB_URL)
async_mongodb = async_mongodb_client.get_database()


def init_mongodb() -> bool:
    try:
        if "market_snapshots" not in mongodb.list_collection_names():
            mongodb.create_collection("market_snapshots")
            mongodb.market_snapshots.create_index("symbol")
            mongodb.market_snapshots.create_index("timestamp")

        if "technical_analysis" not in mongodb.list_collection_names():
            mongodb.create_collection("technical_analysis")
            mongodb.technical_analysis.create_index("symbol")
            mongodb.technical_analysis.create_index("timestamp")
        return True
    except Exception as e:
        print(f"Error initializing MongoDB: {e}")
        return False


class TradeStatus(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class StrategyStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class AgentStatus(str, enum.Enum):
    RUNNING = "running"
    STOPPED = "stopped"
    ERROR = "error"


class Signal(Base):  # type: ignore[misc, valid-type]
    __tablename__ = "signals"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, nullable=False)
    direction = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)
    indicators = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    def model_dump(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat(),
            "direction": self.direction,
            "confidence": self.confidence,
            "indicators": self.indicators,
            "created_at": self.created_at.isoformat(),
        }


class Trade(Base):  # type: ignore[misc, valid-type]
    __tablename__ = "trades"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, nullable=False)
    direction = Column(String, nullable=False)
    entry_time = Column(DateTime, nullable=False)
    exit_time = Column(DateTime, nullable=True)
    entry_price = Column(Float, nullable=False)
    exit_price = Column(Float, nullable=True)
    quantity = Column(Float, nullable=False)
    status: Column[TradeStatus] = Column(
        Enum(TradeStatus), default=TradeStatus.OPEN
    )
    created_at: Column[datetime] = Column(DateTime, default=datetime.utcnow)
    updated_at: Column[datetime] = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    def model_dump(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "symbol": self.symbol,
            "direction": self.direction,
            "entry_time": self.entry_time.isoformat(),
            "exit_time": self.exit_time.isoformat() if self.exit_time else None,
            "entry_price": self.entry_price,
            "exit_price": self.exit_price,
            "quantity": self.quantity,
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class Strategy(Base):  # type: ignore[misc, valid-type]
    __tablename__ = "strategies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)
    parameters = Column(JSON, nullable=False)
    status: Column[StrategyStatus] = Column(
        Enum(StrategyStatus), default=StrategyStatus.INACTIVE
    )
    created_at: Column[datetime] = Column(DateTime, default=datetime.utcnow)
    updated_at: Column[datetime] = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    def model_dump(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "parameters": self.parameters,
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class Agent(Base):  # type: ignore[misc, valid-type]
    __tablename__ = "agents"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String, nullable=False)
    status: Column[AgentStatus] = Column(
        Enum(AgentStatus), default=AgentStatus.STOPPED
    )
    last_updated: Column[datetime] = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    def model_dump(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type,
            "status": self.status.value,
            "last_updated": self.last_updated.isoformat(),
        }


# Database Dependency
def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Create all tables
def init_db() -> None:
    Base.metadata.create_all(bind=engine)
