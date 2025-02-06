from decimal import Decimal

TRADING_CONFIG = {
    # Trading parameters
    "position_size": Decimal("0.01"),  # 0.01 SOL per trade
    "max_slippage": Decimal("0.5"),    # 0.5% maximum slippage
    "platform_fee": Decimal("0.002"),   # 0.2% platform fee
    
    # Risk management
    "max_position_size": Decimal("1000.0"),
    "max_drawdown": Decimal("0.15"),
    "max_daily_loss": Decimal("500.0"),
    "max_leverage": Decimal("1.0"),
    "min_margin_level": Decimal("1.5"),
    "max_concentration": Decimal("0.2"),
    
    # Technical indicators
    "rsi_period": 14,
    "rsi_overbought": 70,
    "rsi_oversold": 30,
    "ma_fast": 10,
    "ma_slow": 20,
    
    # Market requirements
    "min_volume": Decimal("1000.0"),
    "min_liquidity": Decimal("10000.0"),
    
    # Anti-MEV protection
    "use_anti_mev": True,
    
    # Monitoring
    "log_level": "INFO",
    "monitor_interval": 5,  # seconds
    
    # DEX settings
    "dex_platform": "gmgn",
    "base_token": "SOL",
    "quote_token": "USDC"
}

RISK_LIMITS = {
    "max_position_size": Decimal("1000.0"),
    "max_drawdown": Decimal("0.15"),
    "max_daily_loss": Decimal("500.0"),
    "max_leverage": Decimal("1.0"),
    "min_margin_level": Decimal("1.5"),
    "max_concentration": Decimal("0.2")
}
