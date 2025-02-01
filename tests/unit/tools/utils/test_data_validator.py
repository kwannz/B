"""
数据验证器测试
"""

from datetime import datetime, timedelta
from decimal import Decimal

import pytest

from tradingbot.shared.data_validator import DataValidator


def test_validate_required_fields():
    """测试必需字段验证"""
    data = {"title": "Test", "content": "Content", "url": None}
    required = ["title", "content", "url", "author"]

    missing = DataValidator.validate_required_fields(data, required)
    assert "author" in missing
    assert "url" in missing
    assert len(missing) == 2


def test_validate_string_field():
    """测试字符串验证"""
    # 长度验证
    errors = DataValidator.validate_string_field(
        "test", "title", min_length=5, max_length=10
    )
    assert len(errors) == 1
    assert "长度不能小于5" in errors[0]

    # 格式验证
    errors = DataValidator.validate_string_field(
        "test123", "username", pattern=r"^[a-zA-Z]+$"
    )
    assert len(errors) == 1
    assert "格式无效" in errors[0]

    # 类型验证
    errors = DataValidator.validate_string_field(123, "title")
    assert len(errors) == 1
    assert "必须是字符串类型" in errors[0]


def test_validate_numeric_field():
    """测试数值验证"""
    # 范围验证
    errors = DataValidator.validate_numeric_field(
        5.5, "score", min_value=0.0, max_value=5.0
    )
    assert len(errors) == 1
    assert "不能超过5.0" in errors[0]

    # Decimal类型
    errors = DataValidator.validate_numeric_field(
        Decimal("3.14"), "price", min_value=0.0
    )
    assert len(errors) == 0

    # 类型验证
    errors = DataValidator.validate_numeric_field("123", "amount")
    assert len(errors) == 1
    assert "必须是数值类型" in errors[0]


def test_validate_datetime_field():
    """测试日期时间验证"""
    now = datetime.utcnow()
    min_date = now - timedelta(days=7)
    max_date = now + timedelta(days=1)

    # ISO字符串验证
    errors = DataValidator.validate_datetime_field(
        "2024-02-25T00:00:00Z", "published_at", min_date=min_date, max_date=max_date
    )
    assert len(errors) == 0

    # 范围验证
    old_date = now - timedelta(days=10)
    errors = DataValidator.validate_datetime_field(
        old_date, "published_at", min_date=min_date
    )
    assert len(errors) == 1
    assert "不能早于" in errors[0]

    # 格式验证
    errors = DataValidator.validate_datetime_field("invalid-date", "published_at")
    assert len(errors) == 1
    assert "日期格式无效" in errors[0]


def test_validate_url_field():
    """测试URL验证"""
    # 有效URL
    errors = DataValidator.validate_url_field(
        "https://example.com/path?param=value", "url"
    )
    assert len(errors) == 0

    # 无效URL
    errors = DataValidator.validate_url_field("not-a-url", "url")
    assert len(errors) == 1
    assert "不是有效的URL格式" in errors[0]

    # 类型验证
    errors = DataValidator.validate_url_field(123, "url")
    assert len(errors) == 1
    assert "必须是字符串类型" in errors[0]


def test_validate_enum_field():
    """测试枚举验证"""
    valid_values = ["buy", "sell", "hold"]

    # 有效值
    errors = DataValidator.validate_enum_field("buy", "action", valid_values)
    assert len(errors) == 0

    # 无效值
    errors = DataValidator.validate_enum_field("invalid", "action", valid_values)
    assert len(errors) == 1
    assert "必须是: buy, sell, hold" in errors[0]


def test_validate_custom():
    """测试自定义验证"""

    # 自定义验证函数
    def is_positive(value):
        return value > 0

    # 有效值
    errors = DataValidator.validate_custom(10, "quantity", is_positive, "必须是正数")
    assert len(errors) == 0

    # 无效值
    errors = DataValidator.validate_custom(-5, "quantity", is_positive, "必须是正数")
    assert len(errors) == 1
    assert "必须是正数" in errors[0]

    # 验证异常
    def failing_validator(value):
        raise ValueError("验证失败")

    errors = DataValidator.validate_custom("test", "field", failing_validator, "错误")
    assert len(errors) == 1
    assert "验证失败" in errors[0]


if __name__ == "__main__":
    pytest.main(["-v", __file__])
