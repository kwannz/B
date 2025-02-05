from prometheus_client import Counter, Gauge, Histogram, Info
from typing import Dict

# Trading Metrics
TRADE_COUNT = Counter(
    "tradingbot_trades_total",
    "Total number of trades executed",
    ["status", "market"]
)

TRADE_VOLUME = Counter(
    "tradingbot_trade_volume_total",
    "Total trading volume in base currency",
    ["market"]
)

TRADE_LATENCY = Histogram(
    "tradingbot_trade_latency_seconds",
    "Time taken to execute trades",
    ["market"]
)

# System Metrics
SYSTEM_MEMORY = Gauge(
    "tradingbot_system_memory_bytes",
    "Current system memory usage"
)

CPU_USAGE = Gauge(
    "tradingbot_cpu_usage_percent",
    "Current CPU usage percentage"
)

# Market Metrics
MARKET_PRICE = Gauge(
    "tradingbot_market_price",
    "Current market price",
    ["market"]
)

MARKET_VOLUME = Gauge(
    "tradingbot_market_volume_24h",
    "24-hour market volume",
    ["market"]
)

# Risk Metrics
RISK_EXPOSURE = Gauge(
    "tradingbot_risk_exposure",
    "Current risk exposure level",
    ["market"]
)

def record_trade(market: str, status: str, volume: float, latency: float):
    """Record trade metrics."""
    TRADE_COUNT.labels(status=status, market=market).inc()
    TRADE_VOLUME.labels(market=market).inc(volume)
    TRADE_LATENCY.labels(market=market).observe(latency)

def update_system_metrics(memory_bytes: float, cpu_percent: float):
    """Update system resource metrics."""
    SYSTEM_MEMORY.set(memory_bytes)
    CPU_USAGE.set(cpu_percent)

def update_market_metrics(market: str, price: float, volume: float):
    """Update market-related metrics."""
    MARKET_PRICE.labels(market=market).set(price)
    MARKET_VOLUME.labels(market=market).set(volume)

def update_risk_metrics(market: str, exposure: float):
    """Update risk-related metrics."""
    RISK_EXPOSURE.labels(market=market).set(exposure)
