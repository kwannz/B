"""Database session management."""

from contextlib import contextmanager
from typing import Generator, Optional
from unittest.mock import MagicMock


@contextmanager
def get_tenant_session() -> Generator[MagicMock, None, None]:
    """Get a database session for tenant operations."""
    session = MagicMock()
    try:
        yield session
    finally:
        session.close()


@contextmanager
def tenant_session(tenant_id: Optional[str] = None) -> Generator[MagicMock, None, None]:
    """Get a database session for a specific tenant."""
    session = MagicMock()
    try:
        yield session
    finally:
        session.close()
