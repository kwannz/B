from datetime import datetime
from typing import Dict, Optional

from pydantic import BaseModel, Field, confloat

from .base import PyObjectId


class Signal(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    strategy_id: PyObjectId
    symbol: str
    side: str
    strength: confloat(ge=0, le=1)
    metadata: Dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True


class SignalCreate(BaseModel):
    strategy_id: PyObjectId
    symbol: str
    side: str
    strength: confloat(ge=0, le=1)
    metadata: Dict = Field(default_factory=dict)
