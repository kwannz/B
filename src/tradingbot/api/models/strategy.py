from datetime import datetime
from typing import Dict, Optional

from pydantic import BaseModel, Field

from .base import PyObjectId


class Strategy(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    name: str
    description: Optional[str] = None
    status: str = "inactive"
    config: Dict = Field(default_factory=dict)
    metadata: Dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True


class StrategyCreate(BaseModel):
    name: str
    description: Optional[str] = None
    config: Dict = Field(default_factory=dict)
    metadata: Dict = Field(default_factory=dict)
