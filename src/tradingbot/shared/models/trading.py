"""Trading models and enums"""
from enum import Enum, auto

class TradeStatus(Enum):
    """Trade status enum"""
    PENDING = auto()
    SUBMITTED = auto()
    PARTIAL = auto()
    FILLED = auto()
    CANCELLED = auto()
    REJECTED = auto()
    EXPIRED = auto()

class OrderType(Enum):
    """Order type enum"""
    MARKET = auto()
    LIMIT = auto()
    STOP = auto()
    STOP_LIMIT = auto()
    TRAILING_STOP = auto()

class OrderSide(Enum):
    """Order side enum"""
    BUY = auto()
    SELL = auto()

class PositionSide(Enum):
    """Position side enum"""
    LONG = auto()
    SHORT = auto()

class TimeInForce(Enum):
    """Time in force enum"""
    GTC = auto()  # Good till cancelled
    IOC = auto()  # Immediate or cancel
    FOK = auto()  # Fill or kill
    GTD = auto()  # Good till date

class OrderStatus(Enum):
    """Order status enum"""
    NEW = auto()
    PARTIALLY_FILLED = auto()
    FILLED = auto()
    CANCELLED = auto()
    REJECTED = auto()
    EXPIRED = auto()

class TradingError(Exception):
    """Base class for trading errors"""
    pass

class InsufficientFundsError(TradingError):
    """Raised when account has insufficient funds"""
    pass

class InvalidOrderError(TradingError):
    """Raised when order parameters are invalid"""
    pass

class MarketClosedError(TradingError):
    """Raised when market is closed"""
    pass

class ExecutionError(TradingError):
    """Raised when order execution fails"""
    pass
