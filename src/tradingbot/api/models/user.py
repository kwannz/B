"""
User related models
"""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from bson import ObjectId
from pydantic import BaseModel, EmailStr, Field

from .base import PyObjectId


class Account(BaseModel):
    """Account model."""
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    user_id: PyObjectId
    balance: Decimal = Field(default=Decimal("0.0"))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {ObjectId: str, datetime: lambda dt: dt.isoformat()}
        populate_by_name = True
        arbitrary_types_allowed = True


class UserBase(BaseModel):
    """Base user model."""

    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    is_active: bool = True
    is_admin: bool = False
    api_key_permissions: List[str] = []


class UserCreate(UserBase):
    """User creation model."""

    password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)


class UserUpdate(BaseModel):
    """User update model."""

    email: Optional[EmailStr] = None
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    password: Optional[str] = Field(None, min_length=8)
    is_active: Optional[bool] = None
    api_key_permissions: Optional[List[str]] = None


class User(UserBase):
    """User model with MongoDB id."""

    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None

    class Config:
        json_encoders = {ObjectId: str, datetime: lambda dt: dt.isoformat()}
        populate_by_name = True
        arbitrary_types_allowed = True


class UserInDB(User):
    """User model with hashed password."""

    hashed_password: str


class Token(BaseModel):
    """Token model."""

    access_token: str
    token_type: str = "bearer"
    expires_at: datetime


class TokenData(BaseModel):
    """Token data model."""

    user_id: str
    expires_at: datetime
