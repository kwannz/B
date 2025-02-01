from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import declarative_base
from datetime import datetime

Base = declarative_base()


class SentimentAnalysis(Base):
    __tablename__ = "sentiment_analysis"

    id = Column(Integer, primary_key=True)
    source_id = Column(String, unique=True, nullable=False)
    score = Column(Float, nullable=False)
    sentiment = Column(String, nullable=False)
    language = Column(String(2), nullable=False)
    raw_text = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class AgentSentimentSignal(Base):
    __tablename__ = "agent_sentiment_signals"

    id = Column(Integer, primary_key=True)
    agent_id = Column(String, nullable=False)
    symbol = Column(String, nullable=False)
    sentiment_score = Column(Float, nullable=False)
    confidence = Column(Float, nullable=False)
    signal_strength = Column(Float, nullable=False)
    meta_info = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class CombinedMarketSentiment(Base):
    __tablename__ = "combined_market_sentiment"

    id = Column(Integer, primary_key=True)
    symbol = Column(String, nullable=False)
    news_sentiment = Column(Float, nullable=False)
    social_sentiment = Column(Float, nullable=False)
    market_sentiment = Column(Float, nullable=False)
    combined_score = Column(Float, nullable=False)
    source_signals = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
