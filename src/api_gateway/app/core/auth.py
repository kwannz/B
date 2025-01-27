from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr
from datetime import datetime

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

class User(BaseModel):
    email: str  # Required field, no longer optional
    full_name: Optional[str] = None
    disabled: Optional[bool] = False

class TokenData(BaseModel):
    email: str  # Changed from username to email

async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # TODO: Implement actual token validation
        user = User(email="test@example.com")  # Removed username, using email only
        return user
    except Exception:
        raise credentials_exception

async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.disabled:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user
