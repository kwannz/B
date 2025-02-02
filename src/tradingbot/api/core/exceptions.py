"""
Custom exceptions for the Trading Bot API
"""

from typing import Any, Dict, Optional


class TradingBotException(Exception):
    """Base exception for trading bot errors"""

    def __init__(
        self,
        status_code: int,
        detail: str,
        internal_code: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None,
    ):
        self.status_code = status_code
        self.detail = detail
        self.internal_code = internal_code
        self.data = data or {}
        super().__init__(detail)


class ValidationError(TradingBotException):
    """Raised when input validation fails"""

    def __init__(self, detail: str, data: Optional[Dict[str, Any]] = None):
        super().__init__(
            status_code=422, detail=detail, internal_code="VALIDATION_ERROR", data=data
        )


class AuthenticationError(TradingBotException):
    """Raised when authentication fails"""

    def __init__(self, detail: str = "Authentication failed"):
        super().__init__(
            status_code=401, detail=detail, internal_code="AUTHENTICATION_ERROR"
        )


class AuthorizationError(TradingBotException):
    """Raised when authorization fails"""

    def __init__(self, detail: str = "Not authorized"):
        super().__init__(
            status_code=403, detail=detail, internal_code="AUTHORIZATION_ERROR"
        )


class NotFoundError(TradingBotException):
    """Raised when a resource is not found"""

    def __init__(self, detail: str = "Resource not found"):
        super().__init__(
            status_code=404, detail=detail, internal_code="NOT_FOUND_ERROR"
        )


class TradingError(TradingBotException):
    """Raised when a trading operation fails"""

    def __init__(
        self,
        detail: str,
        data: Optional[Dict[str, Any]] = None,
        internal_code: str = "TRADING_ERROR",
    ):
        super().__init__(
            status_code=400, detail=detail, internal_code=internal_code, data=data
        )


class OrderError(TradingError):
    """Raised when an order operation fails"""

    def __init__(self, detail: str, data: Optional[Dict[str, Any]] = None):
        super().__init__(detail=detail, data=data, internal_code="ORDER_ERROR")


class PositionError(TradingError):
    """Raised when a position operation fails"""

    def __init__(self, detail: str, data: Optional[Dict[str, Any]] = None):
        super().__init__(detail=detail, data=data, internal_code="POSITION_ERROR")


class RiskLimitError(TradingError):
    """Raised when a risk limit is exceeded"""

    def __init__(self, detail: str, data: Optional[Dict[str, Any]] = None):
        super().__init__(detail=detail, data=data, internal_code="RISK_LIMIT_ERROR")


class ExchangeError(TradingBotException):
    """Raised when an exchange operation fails"""

    def __init__(
        self, detail: str, data: Optional[Dict[str, Any]] = None, status_code: int = 502
    ):
        super().__init__(
            status_code=status_code,
            detail=detail,
            internal_code="EXCHANGE_ERROR",
            data=data,
        )


class DatabaseError(TradingBotException):
    """Raised when a database operation fails"""

    def __init__(self, detail: str = "Database operation failed"):
        super().__init__(status_code=500, detail=detail, internal_code="DATABASE_ERROR")


class CacheError(TradingBotException):
    """Raised when a cache operation fails"""

    def __init__(self, detail: str = "Cache operation failed"):
        super().__init__(status_code=500, detail=detail, internal_code="CACHE_ERROR")


class MarketDataError(TradingBotException):
    """Raised when market data operations fail"""

    def __init__(self, detail: str = "Market data operation failed"):
        super().__init__(
            status_code=503,
            detail=detail,
            internal_code="MARKET_DATA_ERROR"
        )
