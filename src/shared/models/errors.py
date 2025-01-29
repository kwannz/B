class TradingError(Exception):
    """Base exception class for trading-related errors."""
    pass

class ValidationError(TradingError):
    """Exception raised for validation errors."""
    pass

class ExecutionError(TradingError):
    """Exception raised for trade execution errors."""
    pass

class ConfigurationError(TradingError):
    """Exception raised for configuration-related errors."""
    pass

class MarketError(TradingError):
    """Exception raised for market-related errors."""
    pass

class WalletError(TradingError):
    """Exception raised for wallet-related errors."""
    pass
