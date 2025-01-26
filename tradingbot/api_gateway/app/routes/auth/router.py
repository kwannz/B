from fastapi import APIRouter, HTTPException, Request, status, Depends
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, field_validator, ValidationError
import re
import logging

from ...core.auth import (
    SignupRequest,
    get_password_hash,
    verify_password,
    create_access_token,
    extract_request_context,
    Token,
    get_current_active_user
)
from ...models.user import User, UserCreate, UserRole

router = APIRouter()
logger = logging.getLogger(__name__)

class SignupRequestExtended(SignupRequest):
    """Extended signup request with additional validation."""
    
    @classmethod
    def validate_password(cls, password: str) -> None:
        """Validate password strength."""
        if len(password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 8 characters long"
            )
        if not re.search(r'[A-Z]', password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must contain at least one uppercase letter"
            )
        if not re.search(r'[a-z]', password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must contain at least one lowercase letter"
            )
        if not re.search(r'\d', password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must contain at least one number"
            )
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must contain at least one special character"
            )

    @classmethod
    def validate_email(cls, email: str) -> None:
        """Validate email format."""
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid email format"
            )

@router.post("/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
async def signup(request: Request, signup_data: SignupRequestExtended):
    """Create a new user account."""
    try:
        # Extract request context for logging
        context = extract_request_context(request)
        logger.info(f"Processing signup request from {context['ip']}")
        
        # Validate password and email format
        SignupRequestExtended.validate_password(signup_data.password)
        SignupRequestExtended.validate_email(signup_data.email)
        
        # Check if user already exists
        existing_user = await User.get_by_email(signup_data.email)
        if existing_user:
            logger.warning(f"Signup attempt with existing email: {signup_data.email}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )

        # Create new user with hashed password
        hashed_password = get_password_hash(signup_data.password)
        user_data = UserCreate(
            email=signup_data.email,
            username=signup_data.username,
            hashed_password=hashed_password,
            disabled=False,
            roles=[UserRole(
                name="backend_developer",
                permissions=["execute_market_maker_trades"]
            )],
            request_context=context
        )
        
        user = await User.create(user_data)
        if not user:
            logger.error(f"Failed to create user: {signup_data.email}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user"
            )
        
        logger.info(f"Successfully created user: {signup_data.email}")
        
        # Create access token
        access_token = create_access_token(
            data={"sub": user.username}
        )
        
        return Token(access_token=access_token, token_type="bearer")
        
    except HTTPException as e:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Unexpected error during signup: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred"
        )

@router.post("/login", response_model=Token)
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends()
):
    """Authenticate user and return JWT token."""
    # Extract request context for logging
    context = extract_request_context(request)
    
    # Get user by email
    user = await User.get_by_email(form_data.username)  # username field contains email
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verify password
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if user is active
    if user.disabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    # Create access token
    access_token = create_access_token(
        data={"sub": user.username}
    )
    
    return Token(access_token=access_token, token_type="bearer")
