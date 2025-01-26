import os
import asyncio
from datetime import datetime, timedelta
from typing import Optional, Dict
from fastapi import HTTPException, Request, Depends, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from ..core.config import settings

# Import common dependencies
import sys
import os
import importlib
from types import ModuleType

# Add project root to Python path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Initialize module-level variables
User = None
UserCreate = None
UserRole = None
UserStorage = None
TEST_USER_DATA = None

def setup_test_environment():
    """Set up test environment and import test classes."""
    global User, UserCreate, UserRole, UserStorage, TEST_USER_DATA
    
    # Import test classes
    from tests.unit.mocks import User, UserStorage, UserCreate, UserRole
    
    # Make classes available at module level
    globals().update({
        'User': User,
        'UserCreate': UserCreate,
        'UserRole': UserRole,
        'UserStorage': UserStorage
    })
    
    # Initialize test user data
    TEST_USER_DATA = {
        'email': "testuser@example.com",
        'username': "testuser",
        'hashed_password': "hashed_password",
        'disabled': False,
        'roles': [
            {
                'name': "backend_developer",
                'permissions': ["execute_market_maker_trades"]
            }
        ]
    }
    
    # Clear any existing test users
    UserStorage.clear_users()
    
    return User, UserCreate, UserRole, UserStorage

def setup_prod_environment():
    """Set up production environment and import production classes."""
    global User
    from ..models.user import User
    return User

# Set up environment based on TEST_MODE
if os.getenv('TEST_MODE') == 'true':
    User, UserCreate, UserRole, UserStorage = setup_test_environment()
else:
    User = setup_prod_environment()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class SignupRequest(BaseModel):
    email: str
    password: str
    username: str

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def extract_request_context(request: Request) -> Dict[str, Optional[str]]:
    return {
        "ip": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent"),
        "timestamp": datetime.utcnow().isoformat()
    }

async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # Handle non-string tokens
        if not isinstance(token, str):
            raise credentials_exception
            
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    
    try:
        # In test mode, use UserStorage
        if os.getenv('TEST_MODE') == 'true':
            user = await UserStorage.get_by_email(token_data.username)
            if user is None:
                # Only create default test user if the requested email matches
                if token_data.username == "testuser@example.com":
                    test_user = UserCreate(**TEST_USER_DATA)
                    user = await UserStorage.create(test_user)
                else:
                    raise credentials_exception
            return user
        else:
            user = await User.get_by_email(token_data.username)
            
        if user is None:
            raise credentials_exception
        return user
    except Exception as e:
        raise credentials_exception

async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.disabled:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user
