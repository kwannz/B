import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import asyncio
from src.backend.data_infrastructure.data_pipeline import DataPipeline


@pytest.fixture
def sample_market_data():
    """创建示例市场数据"""
    return {
        "timestamp": datetime.now(),
        "open": 100.0,
        "high": 105.0,
        "low": 95.0,
        "close": 102.0,
        "volume": 1000.0,
    }


@pytest.fixture
def sample_trading_data():
    """创建示例交易数据"""
    return {
        "timestamp": datetime.now(),
        "trade_id": 1,
        "price": 102.0,
        "amount": 1.0,
        "side": "buy",
    }


@pytest.fixture
def sample_social_data():
    """创建示例社交媒体数据"""
    return {
        "timestamp": datetime.now(),
        "text": "Test message",
        "sentiment": 0.5,
        "influence_score": 0.8,
        "platform": "twitter",
    }


@pytest.fixture
def data_pipeline():
    """创建DataPipeline实例"""
    config = {"batch_size": 2, "max_workers": 2, "buffer_size": 1000}
    return DataPipeline(config)


class TestDataPipeline:
    @pytest.mark.asyncio
    async def test_market_data_processing(self, data_pipeline, sample_market_data):
        """测试市场数据处理"""
        # 创建回调函数
        processed_data = None

        async def callback(df):
            nonlocal processed_data
            processed_data = df

        # 处理数据
        for _ in range(2):  # 发送两条数据触发批处理
            await data_pipeline.process_market_data(sample_market_data, callback)

        # 验证处理结果
        assert len(data_pipeline.market_buffer) == 0
        assert not data_pipeline.processed_market_data.empty
        assert processed_data is not None
        assert len(processed_data) == 2

    @pytest.mark.asyncio
    async def test_trading_data_processing(self, data_pipeline, sample_trading_data):
        """测试交易数据处理"""
        # 创建回调函数
        processed_data = None

        async def callback(df):
            nonlocal processed_data
            processed_data = df

        # 处理数据
        for _ in range(2):
            await data_pipeline.process_trading_data(sample_trading_data, callback)

        # 验证处理结果
        assert len(data_pipeline.trading_buffer) == 0
        assert not data_pipeline.processed_trading_data.empty
        assert processed_data is not None
        assert len(processed_data) == 2

    @pytest.mark.asyncio
    async def test_social_data_processing(self, data_pipeline, sample_social_data):
        """测试社交媒体数据处理"""
        # 创建回调函数
        processed_data = None

        async def callback(df):
            nonlocal processed_data
            processed_data = df

        # 处理数据
        for _ in range(2):
            await data_pipeline.process_social_data(sample_social_data, callback)

        # 验证处理结果
        assert len(data_pipeline.social_buffer) == 0
        assert not data_pipeline.processed_social_data.empty
        assert processed_data is not None
        assert len(processed_data) == 2

    @pytest.mark.asyncio
    async def test_buffer_management(self, data_pipeline, sample_market_data):
        """测试缓冲区管理"""
        # 添加数据到缓冲区
        await data_pipeline.process_market_data(sample_market_data)

        # 验证缓冲区状态
        status = data_pipeline.get_buffer_status()
        assert status["market_buffer_size"] == 1
        assert status["processed_market_size"] == 0

        # 清空缓冲区
        await data_pipeline.clear_buffers()

        # 验证清空结果
        status = data_pipeline.get_buffer_status()
        assert status["market_buffer_size"] == 0
        assert status["processed_market_size"] == 0

    @pytest.mark.asyncio
    async def test_latest_data_retrieval(self, data_pipeline, sample_market_data):
        """测试最新数据获取"""
        # 处理一批数据
        for _ in range(2):
            await data_pipeline.process_market_data(sample_market_data)

        # 获取最新数据
        latest_data = await data_pipeline.get_latest_data("market", n_records=1)

        # 验证结果
        assert not latest_data.empty
        assert len(latest_data) == 1

    @pytest.mark.asyncio
    async def test_monitoring(self, data_pipeline):
        """测试监控功能"""
        # 启动监控任务
        monitor_task = asyncio.create_task(data_pipeline.start_monitoring(interval=1))

        # 等待几个监控周期
        await asyncio.sleep(2)

        # 取消监控任务
        monitor_task.cancel()
        try:
            await monitor_task
        except asyncio.CancelledError:
            pass

    def test_processing_stats(self, data_pipeline):
        """测试处理统计信息"""
        stats = data_pipeline.get_processing_stats()

        # 验证统计信息结构
        assert "market_processing_time" in stats
        assert "trading_processing_time" in stats
        assert "social_processing_time" in stats

    @pytest.mark.asyncio
    async def test_error_handling(self, data_pipeline):
        """测试错误处理"""
        # 测试无效数据
        invalid_data = {"invalid": "data"}
        await data_pipeline.process_market_data(invalid_data)

        # 验证错误处理后的状态
        assert len(data_pipeline.market_buffer) == 1
        assert data_pipeline.processed_market_data.empty

    @pytest.mark.asyncio
    async def test_concurrent_processing(
        self, data_pipeline, sample_market_data, sample_trading_data, sample_social_data
    ):
        """测试并发处理"""
        # 创建并发任务
        tasks = []
        for _ in range(2):
            tasks.extend(
                [
                    data_pipeline.process_market_data(sample_market_data),
                    data_pipeline.process_trading_data(sample_trading_data),
                    data_pipeline.process_social_data(sample_social_data),
                ]
            )

        # 等待所有任务完成
        await asyncio.gather(*tasks)

        # 验证处理结果
        status = data_pipeline.get_buffer_status()
        assert status["market_buffer_size"] == 0
        assert status["trading_buffer_size"] == 0
        assert status["social_buffer_size"] == 0

    @pytest.mark.asyncio
    async def test_callback_execution(self, data_pipeline, sample_market_data):
        """测试回调函数执行"""
        # 创建回调计数器
        callback_count = 0

        async def callback(df):
            nonlocal callback_count
            callback_count += 1

        # 处理数据
        for _ in range(4):  # 应该触发两次回调
            await data_pipeline.process_market_data(sample_market_data, callback)

        # 验证回调执行次数
        assert callback_count == 2

    @pytest.mark.asyncio
    async def test_buffer_size_limit(self, data_pipeline, sample_market_data):
        """测试缓冲区大小限制"""
        # 设置较小的缓冲区大小
        data_pipeline.buffer_size = 2

        # 处理多条数据
        for _ in range(4):
            await data_pipeline.process_market_data(sample_market_data)

        # 验证处理后的数据大小不超过限制
        assert len(data_pipeline.processed_market_data) <= 2
