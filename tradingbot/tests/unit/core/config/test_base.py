from tradingbot.core.config.base import BaseConfig
def test_base_config():
    config = BaseConfig()
    assert hasattr(config, 'DEBUG')
    assert isinstance(config.DEBUG, bool)
    # 新增对未覆盖属性的测试
    assert config.log_level == "INFO", "默认日志级别应为INFO"
    assert config.api_timeout == 30, "API默认超时应为30秒"
    assert config.max_retries == 3, "默认重试次数应为3次"
