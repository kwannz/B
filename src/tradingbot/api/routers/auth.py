"""
Authentication router
"""

from datetime import datetime, timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError, jwt
from motor.motor_asyncio import AsyncIOMotorDatabase
from passlib.context import CryptContext

from ..core.config import settings
from ..core.deps import get_current_user, get_database
from ..core.exceptions import AuthenticationError, ValidationError
from ..models.user import Token, TokenData, User, UserCreate, UserInDB

router = APIRouter()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Get password hash."""
    return pwd_context.hash(password)


def create_access_token(
    user_id: str, expires_delta: Optional[timedelta] = None
) -> Token:
    """Create access token."""
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode = {"sub": str(user_id), "exp": expire}

    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")

    return Token(access_token=encoded_jwt, token_type="bearer", expires_at=expire)


@router.post("/register", response_model=User, status_code=status.HTTP_201_CREATED)
async def register(
    user_in: UserCreate, db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Register new user."""
    # Validate password match
    if user_in.password != user_in.confirm_password:
        raise ValidationError("Passwords do not match")

    # Check if user exists
    if await db.users.find_one({"email": user_in.email}):
        raise ValidationError("Email already registered")

    if await db.users.find_one({"username": user_in.username}):
        raise ValidationError("Username already taken")

    # Create user
    user_in_db = UserInDB(
        **user_in.model_dump(exclude={"password", "confirm_password"}),
        hashed_password=get_password_hash(user_in.password),
    )

    result = await db.users.insert_one(user_in_db.model_dump(by_alias=True))

    return await db.users.find_one({"_id": result.inserted_id})


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Login user."""
    # Find user
    user = await db.users.find_one(
        {"$or": [{"email": form_data.username}, {"username": form_data.username}]}
    )

    if not user:
        raise AuthenticationError("Incorrect username or password")

    user_in_db = UserInDB(**user)

    # Verify password
    if not verify_password(form_data.password, user_in_db.hashed_password):
        raise AuthenticationError("Incorrect username or password")

    # Check if user is active
    if not user_in_db.is_active:
        raise AuthenticationError("User is inactive")

    # Create access token
    token = create_access_token(str(user_in_db.id))

    # Update last login
    await db.users.update_one(
        {"_id": user_in_db.id},
        {"$set": {"last_login": datetime.utcnow(), "updated_at": datetime.utcnow()}},
    )

    return token


@router.post("/refresh", response_model=Token)
async def refresh_token(current_user: User = Depends(get_current_user)):
    """Refresh access token."""
    return create_access_token(str(current_user.id))


@router.post("/logout")
async def logout(
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Logout user."""
    # Update last login
    await db.users.update_one(
        {"_id": current_user.id}, {"$set": {"updated_at": datetime.utcnow()}}
    )

    return {"message": "Successfully logged out"}


@router.get("/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)) -> Any:
    """Get current user."""
    return current_user
