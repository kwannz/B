from typing import Dict, Optional, Any
from datetime import datetime
from pydantic import BaseModel

class AgentBase(BaseModel):
    name: str
    type: str  # trading or defi
    parameters: Dict[str, Any]
    description: Optional[str] = None
    promotionWords: Optional[str] = None

class AgentCreate(AgentBase):
    pass

class AgentUpdate(BaseModel):
    name: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    description: Optional[str] = None
    promotionWords: Optional[str] = None

class AgentResponse(AgentBase):
    id: str
    status: str
    created_at: datetime
    last_update: Optional[datetime] = None
    wallet_address: Optional[str] = None

    class Config:
        from_attributes = True
