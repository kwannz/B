import asyncio
import logging
import os
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import aiohttp
import aioping
import asyncpg
import psutil
from prometheus_client import Counter, Gauge, Histogram, Summary


@dataclass
class PerformanceMetrics:
    """Performance metrics for monitoring system"""
    # System metrics
    cpu_usage: Gauge
    memory_usage: Gauge
    network_latency: Histogram
    db_query_time: Histogram
    api_response_time: Histogram
    error_count: Counter
    request_count: Counter

    # Trading metrics
    trade_execution_time: Histogram
    slippage: Histogram
    liquidity_depth: Gauge
    order_book_imbalance: Gauge
    cross_dex_spread: Gauge

    # Meme token metrics
    meme_token_volume: Counter
    meme_token_holders: Gauge
    social_sentiment: Gauge
    viral_coefficient: Gauge

    # Risk metrics
    position_concentration: Gauge
    risk_exposure: Gauge
    volatility: Histogram
    drawdown: Gauge


class PerformanceMonitor:
    """性能监控管理器"""

    def __init__(self, config: Dict):
        self.config = config
        self.logger = logging.getLogger(__name__)

        # Initialize metrics
        self.metrics = PerformanceMetrics(
            # System metrics
            cpu_usage=Gauge("system_cpu_usage", "CPU usage percentage"),
            memory_usage=Gauge("system_memory_usage", "Memory usage percentage"),
            network_latency=Histogram("network_latency_seconds", "Network latency"),
            db_query_time=Histogram("db_query_time_seconds", "Database query time"),
            api_response_time=Histogram("api_response_time_seconds", "API response time"),
            error_count=Counter("monitor_error_total", "Total error count", ["type"]),
            request_count=Counter("monitor_request_total", "Total request count", ["endpoint"]),
            
            # Trading metrics
            trade_execution_time=Histogram("trade_execution_time_seconds", "Trade execution time", ["dex"]),
            slippage=Histogram("trade_slippage_percent", "Trade slippage percentage", ["dex", "token_type"]),
            liquidity_depth=Gauge("market_liquidity_depth", "Market liquidity depth", ["dex", "token"]),
            order_book_imbalance=Gauge("order_book_imbalance", "Order book buy/sell imbalance", ["dex", "token"]),
            cross_dex_spread=Gauge("cross_dex_spread_bps", "Spread between DEXs in basis points", ["token_pair"]),
            
            # Meme token metrics
            meme_token_volume=Counter("meme_token_volume", "Meme token trading volume", ["token"]),
            meme_token_holders=Gauge("meme_token_holders", "Number of token holders", ["token"]),
            social_sentiment=Gauge("social_sentiment_score", "Social media sentiment score", ["token"]),
            viral_coefficient=Gauge("viral_coefficient", "Token virality coefficient", ["token"]),
            
            # Risk metrics
            position_concentration=Gauge("position_concentration", "Position concentration percentage", ["token_type"]),
            risk_exposure=Gauge("risk_exposure", "Total risk exposure", ["risk_type"]),
            volatility=Histogram("price_volatility", "Price volatility", ["token", "timeframe"]),
            drawdown=Gauge("max_drawdown", "Maximum drawdown percentage", ["portfolio_type"])
        )

        # 监控配置
        self.monitor_config = {
            "cpu_threshold": config.get("cpu_threshold", 80),  # CPU使用率阈值
            "memory_threshold": config.get("memory_threshold", 80),  # 内存使用率阈值
            "network_threshold": config.get("network_threshold", 0.1),  # 网络延迟阈值(秒)
            "db_query_threshold": config.get("db_query_threshold", 1.0),  # 数据库查询阈值(秒)
            "api_timeout": config.get("api_timeout", 5.0),  # API超时时间(秒)
            "monitor_interval": config.get("monitor_interval", 60),  # 监控间隔(秒)
            "alert_cooldown": config.get("alert_cooldown", 300),  # 告警冷却时间(秒)
        }

        # 监控任务
        self.monitor_task = None
        self.last_alert_time = {}

    async def start(self):
        """启动监控"""
        self.monitor_task = asyncio.create_task(self._monitor_loop())

    async def stop(self):
        """停止监控"""
        if self.monitor_task:
            self.monitor_task.cancel()
            try:
                await self.monitor_task
            except asyncio.CancelledError:
                pass

    async def _monitor_loop(self):
        """监控循环"""
        while True:
            try:
                # 系统资源监控
                await self._monitor_system_resources()

                # 网络延迟监控
                await self._monitor_network_latency()

                # 数据库性能监控
                await self._monitor_database_performance()

                # API性能监控
                await self._monitor_api_performance()

                # 等待下一次监控
                await asyncio.sleep(self.monitor_config["monitor_interval"])

            except Exception as e:
                self.logger.error(f"Monitoring error: {str(e)}")
                self.metrics.error_count.inc()
                await asyncio.sleep(60)

    async def _monitor_system_resources(self):
        """监控系统资源"""
        try:
            # CPU使用率
            cpu_percent = psutil.cpu_percent(interval=1)
            self.metrics.cpu_usage.set(cpu_percent)

            if cpu_percent > self.monitor_config["cpu_threshold"]:
                await self._create_alert("high_cpu_usage", f"CPU usage: {cpu_percent}%")

            # 内存使用率
            memory = psutil.virtual_memory()
            self.metrics.memory_usage.set(memory.percent)

            if memory.percent > self.monitor_config["memory_threshold"]:
                await self._create_alert(
                    "high_memory_usage", f"Memory usage: {memory.percent}%"
                )

        except Exception as e:
            self.logger.error(f"System resource monitoring error: {str(e)}")
            self.metrics.error_count.inc()

    async def _monitor_network_latency(self):
        """监控网络延迟"""
        try:
            # 测试关键服务延迟
            for service in self.config.get("network_services", []):
                try:
                    start_time = time.time()
                    delay = await aioping.ping(service["host"])
                    self.metrics.network_latency.observe(delay)

                    if delay > self.monitor_config["network_threshold"]:
                        await self._create_alert(
                            "high_network_latency",
                            f"High latency to {service['host']}: {delay:.3f}s",
                        )

                except Exception as e:
                    self.logger.error(
                        f"Network latency check error for {service['host']}: {str(e)}"
                    )
                    self.metrics.error_count.inc()

        except Exception as e:
            self.logger.error(f"Network monitoring error: {str(e)}")
            self.metrics.error_count.inc()

    async def _monitor_database_performance(self):
        """监控数据库性能"""
        try:
            # 连接数据库
            conn = await asyncpg.connect(self.config["database_url"])

            try:
                # 测试查询性能
                start_time = time.time()
                await conn.fetch("SELECT 1")
                query_time = time.time() - start_time

                self.metrics.db_query_time.observe(query_time)

                if query_time > self.monitor_config["db_query_threshold"]:
                    await self._create_alert(
                        "slow_database", f"Slow database response: {query_time:.3f}s"
                    )

                # 检查数据库状态
                status = await conn.fetch(
                    """
                    SELECT * FROM pg_stat_activity
                    WHERE state = 'active'
                """
                )

                # 分析长时间运行的查询
                for record in status:
                    if record["state_change"] < datetime.now() - timedelta(minutes=5):
                        await self._create_alert(
                            "long_running_query",
                            f"Long running query detected: {record['query']}",
                        )

            finally:
                await conn.close()

        except Exception as e:
            self.logger.error(f"Database monitoring error: {str(e)}")
            self.metrics.error_count.inc()

    async def _monitor_api_performance(self):
        """Monitor API performance with focus on DEX and meme token endpoints"""
        try:
            async with aiohttp.ClientSession() as session:
                # Monitor DEX endpoints
                for dex in self.config.get("dex_endpoints", []):
                    try:
                        # Monitor liquidity endpoints
                        start_time = time.time()
                        async with session.get(
                            dex["liquidity_url"],
                            timeout=self.monitor_config["api_timeout"]
                        ) as response:
                            response_time = time.time() - start_time
                            self.metrics.api_response_time.labels(endpoint="liquidity").observe(response_time)
                            self.metrics.trade_execution_time.labels(dex=dex["name"]).observe(response_time)

                            if response.status == 200:
                                data = await response.json()
                                self.metrics.liquidity_depth.labels(
                                    dex=dex["name"],
                                    token=data.get("token", "unknown")
                                ).set(float(data.get("depth", 0)))
                            
                            if response_time > dex.get("threshold", 1.0):
                                await self._create_alert(
                                    "slow_dex_response",
                                    f"Slow DEX response from {dex['name']}: {response_time:.3f}s"
                                )

                        # Monitor order book endpoints
                        start_time = time.time()
                        async with session.get(
                            dex["orderbook_url"],
                            timeout=self.monitor_config["api_timeout"]
                        ) as response:
                            response_time = time.time() - start_time
                            self.metrics.api_response_time.labels(endpoint="orderbook").observe(response_time)

                            if response.status == 200:
                                data = await response.json()
                                self.metrics.order_book_imbalance.labels(
                                    dex=dex["name"],
                                    token=data.get("token", "unknown")
                                ).set(float(data.get("imbalance", 0)))

                    except Exception as e:
                        self.logger.error(f"DEX monitoring error for {dex['name']}: {str(e)}")
                        self.metrics.error_count.labels(type="dex_api").inc()

                # Monitor meme token endpoints
                for endpoint in self.config.get("meme_token_endpoints", []):
                    try:
                        start_time = time.time()
                        async with session.get(
                            endpoint["url"],
                            timeout=self.monitor_config["api_timeout"]
                        ) as response:
                            response_time = time.time() - start_time
                            self.metrics.api_response_time.labels(endpoint="meme_data").observe(response_time)

                            if response.status == 200:
                                data = await response.json()
                                token = data.get("token", "unknown")
                                
                                # Update meme token metrics
                                self.metrics.meme_token_volume.labels(token=token).inc(float(data.get("volume", 0)))
                                self.metrics.meme_token_holders.labels(token=token).set(float(data.get("holders", 0)))
                                self.metrics.social_sentiment.labels(token=token).set(float(data.get("sentiment", 0)))
                                self.metrics.viral_coefficient.labels(token=token).set(float(data.get("virality", 0)))

                            if response.status >= 400:
                                await self._create_alert(
                                    "meme_data_error",
                                    f"Meme token data error for {endpoint['url']}: {response.status}"
                                )

                    except Exception as e:
                        self.logger.error(f"Meme token monitoring error: {str(e)}")
                        self.metrics.error_count.labels(type="meme_api").inc()

                # Monitor cross-DEX metrics
                await self._monitor_cross_dex_metrics(session)

        except Exception as e:
            self.logger.error(f"API monitoring error: {str(e)}")
            self.metrics.error_count.labels(type="general").inc()

    async def _monitor_cross_dex_metrics(self, session: aiohttp.ClientSession):
        """Monitor cross-DEX metrics for arbitrage opportunities"""
        try:
            for pair in self.config.get("token_pairs", []):
                prices = {}
                for dex in self.config.get("dex_endpoints", []):
                    try:
                        async with session.get(
                            f"{dex['price_url']}/{pair}",
                            timeout=self.monitor_config["api_timeout"]
                        ) as response:
                            if response.status == 200:
                                data = await response.json()
                                prices[dex["name"]] = float(data.get("price", 0))
                    except Exception:
                        continue

                if len(prices) >= 2:
                    max_price = max(prices.values())
                    min_price = min(prices.values())
                    if min_price > 0:
                        spread_bps = (max_price - min_price) / min_price * 10000
                        self.metrics.cross_dex_spread.labels(token_pair=pair).set(spread_bps)

                        if spread_bps > self.config.get("max_spread_bps", 100):
                            await self._create_alert(
                                "high_cross_dex_spread",
                                f"High spread detected for {pair}: {spread_bps:.2f} bps"
                            )

        except Exception as e:
            self.logger.error(f"Cross-DEX monitoring error: {str(e)}")
            self.metrics.error_count.labels(type="cross_dex").inc()

    async def _create_alert(self, alert_type: str, message: str):
        """创建告警"""
        current_time = time.time()

        # 检查冷却时间
        if alert_type in self.last_alert_time:
            if (
                current_time - self.last_alert_time[alert_type]
                < self.monitor_config["alert_cooldown"]
            ):
                return

        self.last_alert_time[alert_type] = current_time

        # TODO: 实现告警通知
        self.logger.warning(f"Alert: {message}")

    def _get_percentile(self, metric: Histogram, percentile: float) -> float:
        """Get percentile value from histogram metric"""
        try:
            return float(metric._sum.get() * percentile / metric._count.get()) if metric._count.get() > 0 else 0.0
        except Exception:
            return 0.0

    def _get_max(self, metric: Histogram) -> float:
        """Get maximum value from histogram metric"""
        try:
            return float(metric._sum.get()) if metric._count.get() > 0 else 0.0
        except Exception:
            return 0.0

    def _get_moving_average(self, metric: Gauge, hours: int = 24) -> float:
        """Calculate moving average for a metric"""
        try:
            values = [float(metric._value.get())]
            return sum(values) / len(values) if values else 0.0
        except Exception:
            return 0.0

    def _get_volume_change(self, token: str, hours: int = 24) -> float:
        """Calculate volume change percentage"""
        try:
            current = float(self.metrics.meme_token_volume.labels(token=token)._value.get())
            return current
        except Exception:
            return 0.0

    def _get_volume_trend(self, token: str) -> str:
        """Get volume trend direction"""
        try:
            change = self._get_volume_change(token)
            if change > 0.1:
                return "increasing"
            elif change < -0.1:
                return "decreasing"
            return "stable"
        except Exception:
            return "unknown"

    def _get_holder_change(self, token: str, hours: int = 24) -> float:
        """Calculate holder count change"""
        try:
            current = float(self.metrics.meme_token_holders.labels(token=token)._value.get())
            return current
        except Exception:
            return 0.0

    def _get_sentiment_change(self, token: str, hours: int = 24) -> float:
        """Calculate sentiment change"""
        try:
            current = float(self.metrics.social_sentiment.labels(token=token)._value.get())
            return current
        except Exception:
            return 0.0

    def _get_virality_trend(self, token: str) -> str:
        """Get virality coefficient trend"""
        try:
            current = float(self.metrics.viral_coefficient.labels(token=token)._value.get())
            if current > 1.5:
                return "viral"
            elif current > 1.0:
                return "growing"
            return "stable"
        except Exception:
            return "unknown"

    def _get_token_volatility(self, token: str) -> float:
        """Calculate token volatility score"""
        try:
            return float(self.metrics.volatility.labels(token=token, timeframe="1h")._value.get())
        except Exception:
            return 0.0

    def _get_liquidity_score(self, token: str) -> float:
        """Calculate token liquidity score"""
        try:
            depths = []
            for dex in self.config.get("dex_list", []):
                depth = float(self.metrics.liquidity_depth.labels(dex=dex, token=token)._value.get())
                depths.append(depth)
            return sum(depths) / len(depths) if depths else 0.0
        except Exception:
            return 0.0

    def _get_market_impact(self, token: str) -> float:
        """Calculate market impact score"""
        try:
            return 1.0 - self._get_liquidity_score(token)
        except Exception:
            return 1.0

    def _get_concentration_trend(self, token_type: str) -> str:
        """Get position concentration trend"""
        try:
            current = float(self.metrics.position_concentration.labels(token_type=token_type)._value.get())
            limit = self.config.get(f"{token_type}_concentration_limit", 0.2)
            if current > limit * 1.2:
                return "high"
            elif current > limit:
                return "elevated"
            return "normal"
        except Exception:
            return "unknown"

    def _get_exposure_utilization(self, risk_type: str) -> float:
        """Calculate risk exposure utilization"""
        try:
            current = float(self.metrics.risk_exposure.labels(risk_type=risk_type)._value.get())
            limit = self.config.get(f"{risk_type}_exposure_limit", 1.0)
            return current / limit if limit > 0 else 1.0
        except Exception:
            return 0.0

    def _get_volatility_zscore(self, token: str, timeframe: str) -> float:
        """Calculate volatility z-score"""
        try:
            current = float(self.metrics.volatility.labels(token=token, timeframe=timeframe)._value.get())
            return current
        except Exception:
            return 0.0

    def _get_volatility_trend(self, token: str, timeframe: str) -> str:
        """Get volatility trend"""
        try:
            zscore = self._get_volatility_zscore(token, timeframe)
            if zscore > 2.0:
                return "extreme"
            elif zscore > 1.0:
                return "high"
            return "normal"
        except Exception:
            return "unknown"

    def _get_max_drawdown(self, portfolio_type: str, hours: int = 24) -> float:
        """Get maximum drawdown over period"""
        try:
            return float(self.metrics.drawdown.labels(portfolio_type=portfolio_type)._value.get())
        except Exception:
            return 0.0

    def _get_drawdown_recovery_time(self, portfolio_type: str) -> int:
        """Estimate drawdown recovery time in hours"""
        try:
            current = float(self.metrics.drawdown.labels(portfolio_type=portfolio_type)._value.get())
            if current <= 0:
                return 0
            return int(current * 24)  # Simple estimation
        except Exception:
            return 0

    def _get_active_risk_alerts(self) -> List[Dict]:
        """Get list of active risk alerts"""
        try:
            alerts = []
            for risk_type in ["market", "liquidity", "volatility"]:
                utilization = self._get_exposure_utilization(risk_type)
                if utilization > 0.8:
                    alerts.append({
                        "type": risk_type,
                        "level": "high" if utilization > 0.95 else "elevated",
                        "utilization": utilization
                    })
            return alerts
        except Exception:
            return []

    def get_performance_metrics(self) -> Dict:
        """Get performance metrics"""
        try:
            metrics = {
                # System metrics
                "system": {
                    "cpu": {
                        "usage": self.metrics.cpu_usage._value.get(),
                        "load_avg": os.getloadavg(),
                        "process_count": len(psutil.pids())
                    },
                    "memory": {
                        "usage": self.metrics.memory_usage._value.get(),
                        "available": psutil.virtual_memory().available,
                        "total": psutil.virtual_memory().total
                    },
                    "network": {
                        "latency": self.metrics.network_latency._sum.get(),
                        "latency_count": self.metrics.network_latency._count.get(),
                        "error_rate": self.metrics.error_count.labels(type="network")._value.get() / max(1, self.metrics.request_count.labels(endpoint="network")._value.get())
                    },
                    "database": {
                        "query_time": self.metrics.db_query_time._sum.get() / max(1, self.metrics.db_query_time._count.get()),
                        "error_rate": self.metrics.error_count.labels(type="database")._value.get() / max(1, self.metrics.request_count.labels(endpoint="database")._value.get())
                    }
                },
                # API performance
                "api": {
                    "response_time": {
                        endpoint: self.metrics.api_response_time.labels(endpoint=endpoint)._sum.get() / max(1, self.metrics.api_response_time.labels(endpoint=endpoint)._count.get())
                        for endpoint in ["liquidity", "orderbook", "meme_data"]
                    },
                    "error_rates": {
                        t: self.metrics.error_count.labels(type=t)._value.get() / max(1, self.metrics.request_count.labels(endpoint=t)._value.get())
                        for t in ["dex_api", "meme_api", "cross_dex"]
                    },
                    "request_counts": {
                        e: self.metrics.request_count.labels(endpoint=e)._value.get()
                        for e in ["liquidity", "orderbook", "meme_data"]
                    }
                },
            
                # Trading performance
                "trading": {
                    "execution": {
                        dex: {
                            "time": {
                                "avg": self.metrics.trade_execution_time.labels(dex=dex)._sum.get() / max(1, self.metrics.trade_execution_time.labels(dex=dex)._count.get()),
                                "p95": self._get_percentile(self.metrics.trade_execution_time.labels(dex=dex), 0.95),
                                "p99": self._get_percentile(self.metrics.trade_execution_time.labels(dex=dex), 0.99)
                            },
                            "slippage": {
                                "standard": {
                                    "avg": self.metrics.slippage.labels(dex=dex, token_type="standard")._sum.get() / max(1, self.metrics.slippage.labels(dex=dex, token_type="standard")._count.get()),
                                    "max": self._get_max(self.metrics.slippage.labels(dex=dex, token_type="standard"))
                                },
                                "meme": {
                                    "avg": self.metrics.slippage.labels(dex=dex, token_type="meme")._sum.get() / max(1, self.metrics.slippage.labels(dex=dex, token_type="meme")._count.get()),
                                    "max": self._get_max(self.metrics.slippage.labels(dex=dex, token_type="meme"))
                                }
                            }
                        }
                        for dex in self.config.get("dex_list", [])
                    },
                    "liquidity": {
                        dex: {
                            "depth": {
                                token: self.metrics.liquidity_depth.labels(dex=dex, token=token)._value.get()
                                for token in self.config.get("tracked_tokens", [])
                            },
                            "imbalance": {
                                token: self.metrics.order_book_imbalance.labels(dex=dex, token=token)._value.get()
                                for token in self.config.get("tracked_tokens", [])
                            }
                        }
                        for dex in self.config.get("dex_list", [])
                    },
                    "cross_dex": {
                        "spreads": {
                            pair: {
                                "current": self.metrics.cross_dex_spread.labels(token_pair=pair)._value.get(),
                                "avg_24h": self._get_moving_average(self.metrics.cross_dex_spread.labels(token_pair=pair), hours=24)
                            }
                            for pair in self.config.get("token_pairs", [])
                        }
                    }
                },
            
                # Meme token analytics
                "meme_tokens": {
                    token: {
                        "volume": {
                            "current": self.metrics.meme_token_volume.labels(token=token)._value.get(),
                            "change_24h": self._get_volume_change(token, hours=24),
                            "trend": self._get_volume_trend(token)
                        },
                        "holders": {
                            "count": self.metrics.meme_token_holders.labels(token=token)._value.get(),
                            "change_24h": self._get_holder_change(token, hours=24)
                        },
                        "social": {
                            "sentiment": self.metrics.social_sentiment.labels(token=token)._value.get(),
                            "sentiment_change": self._get_sentiment_change(token, hours=24),
                            "virality": self.metrics.viral_coefficient.labels(token=token)._value.get(),
                            "virality_trend": self._get_virality_trend(token)
                        },
                        "risk_metrics": {
                            "volatility": self._get_token_volatility(token),
                            "liquidity_score": self._get_liquidity_score(token),
                            "market_impact": self._get_market_impact(token)
                        }
                    }
                    for token in self.config.get("meme_tokens", [])
                },
            
                # Risk analytics
                "risk": {
                    "portfolio": {
                        "concentration": {
                            t: {
                                "current": self.metrics.position_concentration.labels(token_type=t)._value.get(),
                                "limit": self.config.get(f"{t}_concentration_limit", 0.2),
                                "trend": self._get_concentration_trend(t)
                            }
                            for t in ["standard", "meme"]
                        },
                        "exposure": {
                            t: {
                                "value": self.metrics.risk_exposure.labels(risk_type=t)._value.get(),
                                "limit": self.config.get(f"{t}_exposure_limit", 1.0),
                                "utilization": self._get_exposure_utilization(t)
                            }
                            for t in ["market", "liquidity", "volatility"]
                        }
                    },
                    "market": {
                        "volatility": {
                            token: {
                                tf: {
                                    "current": self.metrics.volatility.labels(token=token, timeframe=tf)._value.get(),
                                    "zscore": self._get_volatility_zscore(token, tf),
                                    "trend": self._get_volatility_trend(token, tf)
                                }
                                for tf in ["1h", "4h", "24h"]
                            }
                            for token in self.config.get("tracked_tokens", [])
                        },
                        "drawdown": {
                            pt: {
                                "current": self.metrics.drawdown.labels(portfolio_type=pt)._value.get(),
                                "max_24h": self._get_max_drawdown(pt, hours=24),
                                "recovery_time": self._get_drawdown_recovery_time(pt)
                            }
                            for pt in ["overall", "meme", "standard"]
                        }
                    },
                    "alerts": self._get_active_risk_alerts()
                }
            }
        except Exception as e:
            self.logger.error(f"Error getting performance metrics: {str(e)}")
            return {
                "system": {},
                "api": {},
                "trading": {},
                "meme_tokens": {},
                "risk": {}
            }
