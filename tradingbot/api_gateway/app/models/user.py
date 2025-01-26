import os
from datetime import datetime
from typing import List, Optional, Dict, ClassVar
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from ..db.models import DBUser, DBRole

class UserRole(BaseModel):
    name: str
    permissions: List[str]

class UserBase(BaseModel):
    email: EmailStr
    username: str
    disabled: bool = False
    roles: List[UserRole] = []

class UserCreate(UserBase):
    hashed_password: str
    request_context: Optional[Dict[str, Optional[str]]] = None

class User(UserBase):
    id: str
    hashed_password: str
    
    # Class variable for test storage
    _test_users: ClassVar[Dict[str, 'User']] = {}

    @classmethod
    async def get_by_email(cls, email: str) -> Optional['User']:
        """Get user by email."""
        if os.getenv('TEST_MODE') == 'true':
            return cls._test_users.get(email)
        # TODO: Implement actual database query
        return None

    @classmethod
    async def create(cls, user_data: UserCreate) -> Optional['User']:
        """Create a new user."""
        if os.getenv('TEST_MODE') == 'true':
            if user_data.email in cls._test_users:
                return None
            new_user = cls(
                id=str(len(cls._test_users) + 1),
                email=user_data.email,
                username=user_data.username,
                hashed_password=user_data.hashed_password,
                disabled=user_data.disabled,
                roles=user_data.roles
            )
            cls._test_users[user_data.email] = new_user
            return new_user
        # TODO: Implement actual database creation
        return None

    class Config:
        orm_mode = True
