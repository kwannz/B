import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from src.backend.data_infrastructure.data_manager import DataManager


@pytest.fixture
def mock_mongodb():
    """模拟MongoDB连接"""
    with patch("motor.motor_asyncio.AsyncIOMotorClient") as mock:
        # 模拟数据库操作
        db = AsyncMock(spec=AsyncIOMotorDatabase)

        # 模拟集合
        collections = ["market_data", "trades", "social_data", "positions"]
        for collection in collections:
            setattr(db, collection, AsyncMock())
            # 模拟查询方法
            getattr(db, collection).find.return_value.to_list.return_value = []
            getattr(db, collection).insert_many = AsyncMock()
            getattr(db, collection).insert_one = AsyncMock()
            getattr(db, collection).create_index = AsyncMock()
            getattr(db, collection).delete_many = AsyncMock()
            getattr(db, collection).count_documents = AsyncMock(return_value=100)

        mock.return_value.__getitem__.return_value = db
        yield mock


@pytest.fixture
def mock_redis():
    """模拟Redis连接"""
    with patch("redis.Redis") as mock:
        mock.return_value.get = Mock(return_value=None)
        mock.return_value.set = Mock(return_value=True)
        mock.return_value.delete = Mock(return_value=True)
        yield mock


@pytest.fixture
def mock_aiohttp_session():
    """模拟aiohttp会话"""
    with patch("aiohttp.ClientSession") as mock:
        mock.return_value.__aenter__.return_value = AsyncMock()
        mock.return_value.__aexit__.return_value = AsyncMock()
        yield mock


@pytest.fixture
def data_manager(mock_mongodb, mock_redis):
    """创建DataManager实例"""
    config = {
        "mongodb_uri": "mongodb://localhost:27017",
        "database_name": "test_db",
        "redis_host": "localhost",
        "redis_port": 6379,
        "collection_interval": 60,
        "retention_period": 90,
        "batch_size": 1000,
        "symbols": ["BTC/USDT", "ETH/USDT"],
        "memory_cache_size": 1000,
        "disk_cache_size": 10000,
        "cache_ttl": 3600,
    }
    return DataManager(config)


class TestDataManager:
    async def test_database_initialization(self, data_manager, mock_mongodb):
        """测试数据库初始化"""
        # 验证MongoDB连接
        mock_mongodb.assert_called_once_with(data_manager.config["mongodb_uri"])

        # 验证索引创建
        market_data = data_manager.db.market_data
        assert market_data.create_index.call_count >= 2

    async def test_market_data_collection(self, data_manager, mock_aiohttp_session):
        """测试市场数据收集"""
        # 模拟K线数据
        kline_data = [
            {
                "timestamp": datetime.now(),
                "open": 50000,
                "high": 51000,
                "low": 49000,
                "close": 50500,
                "volume": 100,
            }
        ]
        data_manager._fetch_kline_data = AsyncMock(return_value=kline_data)

        await data_manager._collect_market_data()

        # 验证数据插入
        assert data_manager.db.market_data.insert_many.called

    async def test_trading_data_collection(self, data_manager):
        """测试交易数据收集"""
        # 模拟交易数据
        trades_data = [
            {
                "timestamp": datetime.now(),
                "symbol": "BTC/USDT",
                "price": 50000,
                "amount": 1.0,
                "side": "buy",
            }
        ]
        data_manager._fetch_recent_trades = AsyncMock(return_value=trades_data)

        await data_manager._collect_trading_data()

        # 验证数据插入
        assert data_manager.db.trades.insert_many.called

    async def test_social_data_collection(self, data_manager):
        """测试社交媒体数据收集"""
        # 模拟社交数据
        social_data = [
            {
                "timestamp": datetime.now(),
                "platform": "twitter",
                "text": "Test message",
                "sentiment": 0.5,
            }
        ]
        data_manager._fetch_social_data = AsyncMock(return_value=social_data)

        await data_manager._collect_social_data()

        # 验证数据插入
        assert data_manager.db.social_data.insert_many.called

    async def test_data_cleanup(self, data_manager):
        """测试数据清理"""
        await data_manager._cleanup_old_data()

        # 验证删除操作
        assert data_manager.db.market_data.delete_many.called
        assert data_manager.db.trades.delete_many.called
        assert data_manager.db.social_data.delete_many.called

    async def test_market_data_retrieval(self, data_manager):
        """测试市场数据获取"""
        # 模拟数据
        mock_data = [
            {"timestamp": datetime.now(), "symbol": "BTC/USDT", "price": 50000}
        ]
        data_manager.db.market_data.find.return_value.to_list.return_value = mock_data

        # 获取数据
        df = await data_manager.get_market_data(
            "BTC/USDT", "kline", datetime.now() - timedelta(days=1), datetime.now()
        )

        assert isinstance(df, pd.DataFrame)
        assert len(df) == len(mock_data)

    async def test_trading_data_retrieval(self, data_manager):
        """测试交易数据获取"""
        # 模拟数据
        mock_data = [
            {
                "timestamp": datetime.now(),
                "symbol": "BTC/USDT",
                "side": "buy",
                "amount": 1.0,
            }
        ]
        data_manager.db.trades.find.return_value.to_list.return_value = mock_data

        # 获取数据
        df = await data_manager.get_trading_data(
            "BTC/USDT", datetime.now() - timedelta(days=1), datetime.now()
        )

        assert isinstance(df, pd.DataFrame)
        assert len(df) == len(mock_data)

    async def test_social_data_retrieval(self, data_manager):
        """测试社交媒体数据获取"""
        # 模拟数据
        mock_data = [
            {"timestamp": datetime.now(), "platform": "twitter", "text": "Test message"}
        ]
        data_manager.db.social_data.find.return_value.to_list.return_value = mock_data

        # 获取数据
        df = await data_manager.get_social_data("BTC/USDT", platform="twitter")

        assert isinstance(df, pd.DataFrame)
        assert len(df) == len(mock_data)

    async def test_data_saving(self, data_manager):
        """测试数据保存"""
        # 测试单条数据保存
        single_data = {"test": "data"}
        await data_manager.save_data("test_collection", single_data)
        assert data_manager.db.test_collection.insert_one.called

        # 测试批量数据保存
        batch_data = [{"test": "data1"}, {"test": "data2"}]
        await data_manager.save_data("test_collection", batch_data)
        assert data_manager.db.test_collection.insert_many.called

    async def test_data_deletion(self, data_manager):
        """测试数据删除"""
        query = {"symbol": "BTC/USDT"}
        await data_manager.delete_data("test_collection", query)
        assert data_manager.db.test_collection.delete_many.called

    def test_cache_stats(self, data_manager):
        """测试缓存统计"""
        stats = data_manager.get_cache_stats()
        assert "memory_usage" in stats
        assert "disk_usage" in stats
        assert "hit_rate" in stats
        assert "miss_rate" in stats

    async def test_database_stats(self, data_manager):
        """测试数据库统计"""
        stats = await data_manager.get_database_stats()
        assert "market_data" in stats
        assert "trades" in stats
        assert "social_data" in stats
        assert "document_count" in stats["market_data"]
