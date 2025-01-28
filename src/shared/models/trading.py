from enum import Enum
from datetime import datetime
from sqlalchemy import Column, String, Float, JSON, DateTime, Boolean, ForeignKey, Enum as SQLEnum
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class TradeStatus(str, Enum):
    PENDING = "pending"
    OPEN = "open"
    CLOSED = "closed"
    CANCELLED = "cancelled"
    FAILED = "failed"

class StrategyType(str, Enum):
    TECHNICAL_ANALYSIS = "technical_analysis"
    SENTIMENT_ANALYSIS = "sentiment_analysis"
    HYBRID = "hybrid"
    CUSTOM = "custom"

class Wallet(Base):
    __tablename__ = 'wallets'

    id = Column(String, primary_key=True)
    tenant_id = Column(String, ForeignKey('tenants.id'), nullable=False)
    address = Column(String, nullable=False)
    chain = Column(String, nullable=False)
    balance = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Strategy(Base):
    __tablename__ = 'strategies'

    id = Column(String, primary_key=True)
    tenant_id = Column(String, ForeignKey('tenants.id'), nullable=False)
    name = Column(String, nullable=False)
    strategy_type = Column(SQLEnum(StrategyType), nullable=False)
    parameters = Column(JSON, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
