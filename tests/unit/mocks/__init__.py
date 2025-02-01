from typing import List, Optional, Dict
from pydantic import BaseModel
import uuid
import sys

# Create module-level variables
__name__ = "tests.unit.mocks"
sys.modules[__name__] = sys.modules[__name__]


class UserRole(BaseModel):
    name: str
    permissions: List[str]

    def __init__(self, **data):
        super().__init__(**data)
        self.__module__ = "tests.unit.mocks"


class UserCreate(BaseModel):
    email: str
    username: str
    hashed_password: str
    disabled: bool = False
    roles: List[UserRole] = []
    request_context: Optional[Dict[str, Optional[str]]] = None

    def __init__(self, **data):
        super().__init__(**data)
        self.__module__ = "tests.unit.mocks"


class User(BaseModel):
    id: str
    email: str
    username: str
    hashed_password: str
    disabled: bool = False
    roles: List[UserRole] = []

    def __init__(self, **data):
        super().__init__(**data)
        self.__module__ = "tests.unit.mocks"

    @classmethod
    async def get_by_email(cls, email: str) -> Optional["User"]:
        """Get user by email."""
        return await UserStorage.get_by_email(email)

    @classmethod
    async def create(cls, user_data: UserCreate) -> Optional["User"]:
        """Create a new user."""
        return await UserStorage.create(user_data)


class UserStorage:
    """Storage class for managing users in tests."""

    _users: Dict[str, User] = {}

    @classmethod
    def clear_users(cls):
        """Clear stored users for testing."""
        cls._users = {}

    @classmethod
    async def get_by_email(cls, email: str) -> Optional[User]:
        """Get user by email."""
        # Check stored users first
        if email in cls._users:
            return cls._users[email]
        return None

    @classmethod
    async def create(cls, user_data: UserCreate) -> Optional[User]:
        """Create a new user."""
        # Check if user already exists
        if user_data.email in cls._users:
            return None

        test_id = str(uuid.uuid4())

        # Convert roles to proper UserRole instances if needed
        roles = []
        if user_data.roles:
            for role in user_data.roles:
                if isinstance(role, dict):
                    roles.append(UserRole(**role))
                elif isinstance(role, UserRole):
                    roles.append(role)
        else:
            roles = [
                UserRole(
                    name="backend_developer",
                    permissions=["execute_market_maker_trades"],
                )
            ]

        new_user = User(
            id=test_id,
            email=user_data.email,
            username=user_data.username,
            hashed_password=user_data.hashed_password,
            disabled=user_data.disabled,
            roles=roles,
        )
        cls._users[user_data.email] = new_user
        return new_user


# Mock the User model's async methods with UserStorage
async def mock_get_by_email(email: str) -> Optional[User]:
    return await UserStorage.get_by_email(email)


async def mock_create(user_data: UserCreate) -> User:
    return await UserStorage.create(user_data)


# Replace User class methods
User.get_by_email = mock_get_by_email
User.create = mock_create
