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
    timestamp: datetime
    price: float
    volume: float
    exchange: str
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
    timestamp: datetime
    raw_text: str
    model_output: Dict[str, Any] = Field(default_factory=dict)
    meta_info: Dict[str, Any] = Field(default_factory=dict)
    
    model_config = {
        "arbitrary_types_allowed": True,
        "protected_namespaces": ()
    }

class AgentAnalysisResult(BaseModel):
    agent_id: str
    agent_type: str
    timestamp: datetime
    input_data: Dict[str, Any] = Field(default_factory=dict)
    analysis_result: Dict[str, Any] = Field(default_factory=dict)
    confidence_score: float = Field(ge=0.0, le=1.0)
    meta_info: Dict[str, Any] = Field(default_factory=dict)
    
    model_config = {
        "arbitrary_types_allowed": True,
        "protected_namespaces": ()
    }
