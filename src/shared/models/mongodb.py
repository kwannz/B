from datetime import datetime
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field

class RawNewsArticle(BaseModel):
    source: str
    title: str
    url: str
    content: str
    author: Optional[str] = None
    published_at: datetime
    analysis_metadata: Dict[str, Any] = Field(default_factory=dict)
    meta_info: Dict[str, Any] = Field(default_factory=dict)
    
    model_config = {
        "arbitrary_types_allowed": True,
        "protected_namespaces": ()
    }

class RawSocialMediaPost(BaseModel):
    platform: str
    post_id: str
    content: str
    author: str
    posted_at: datetime
    engagement_metrics: Dict[str, int] = Field(default_factory=dict)
    meta_info: Dict[str, Any] = Field(default_factory=dict)
    
    model_config = {
        "arbitrary_types_allowed": True,
        "protected_namespaces": ()
    }

class MarketDataSnapshot(BaseModel):
    symbol: str
    price: float = Field(ge=0.0)
    volume: float = Field(ge=0.0)
    timestamp: datetime
    exchange: str
    timeframe: Optional[str] = None
    raw_data: Dict[str, Any] = Field(default_factory=dict)
    meta_info: Dict[str, Any] = Field(default_factory=dict)
    
    model_config = {
        "arbitrary_types_allowed": True,
        "protected_namespaces": ()
    }

class UnstructuredAnalysis(BaseModel):
    source_type: str
    source_id: str
    analysis_type: str
    raw_text: str
    timestamp: datetime
    model_output: Dict[str, Any] = Field(default_factory=dict)
    meta_info: Dict[str, Any] = Field(default_factory=dict)
    
    model_config = {
        "arbitrary_types_allowed": True,
        "protected_namespaces": ()
    }

class AgentAnalysisResult(BaseModel):
    agent_id: str
    symbol: str
    analysis_type: str
    confidence: float = Field(ge=0.0, le=1.0)
    signals: Dict[str, float] = Field(default_factory=dict)
    timestamp: datetime
    meta_info: Dict[str, Any] = Field(default_factory=dict)
    
    model_config = {
        "arbitrary_types_allowed": True,
        "protected_namespaces": ()
    }
