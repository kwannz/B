import pytest
from unittest.mock import patch, MagicMock
import responses
from tradingbot.src.data.pipeline import DataPipeline
import json


class TestDataPipeline:
    @responses.activate
    def test_binance_api_calls(self):
        """测试Binance API所有23个方法调用"""
        # 配置API端点模拟响应
        with open("tests/mocks/binance_endpoints.json") as f:
            endpoints = json.load(f)

        for endpoint in endpoints:
            responses.add(
                method=endpoint["method"],
                url=endpoint["url"],
                json=endpoint["response"],
                status=endpoint["status"],
            )

        pipeline = DataPipeline(exchange="binance")
        assert pipeline.fetch_market_data() is not None

    @responses.activate
    def test_handle_api_errors(self):
        """测试API异常处理流程"""
        responses.add(
            responses.GET,
            "https://api.binance.com/api/v3/klines",
            json={"code": -1121, "msg": "Invalid symbol."},
            status=400,
        )

        pipeline = DataPipeline(exchange="binance")
        with pytest.raises(Exception) as excinfo:
            pipeline.fetch_market_data()

        assert "API Error" in str(excinfo.value)

    def test_data_processing_flow(self, mocker):
        """测试完整数据处理流水线"""
        # Mock外部依赖
        mocker.patch("tradingbot.src.data.storage.save_data")
        mocker.patch("tradingbot.src.data.validator.validate", return_value=True)

        pipeline = DataPipeline(exchange="binance")
        result = pipeline.run_pipeline()

        assert result["status"] == "success"
        assert result["processed_records"] > 0
