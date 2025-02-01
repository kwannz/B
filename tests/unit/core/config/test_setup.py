import os
import re
import sys
import importlib.util
from setuptools import find_packages
from unittest.mock import patch


def import_setup():
    """Import setup.py as a module"""
    spec = importlib.util.spec_from_file_location("setup", "setup.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_setup_configuration():
    """Test setup.py configuration"""
    with patch("setuptools.setup") as mock_setup:
        # 导入并执行setup.py
        setup_module = import_setup()

        # 验证setup被调用
        mock_setup.assert_called_once()

        # 验证参数
        args = mock_setup.call_args[1]
        assert args["name"] == "trading-bot"
        assert args["version"] == "1.0.0"
        assert isinstance(args["packages"], list)
        assert isinstance(args["install_requires"], list)
        assert "numpy>=1.21.0" in args["install_requires"]
        assert "pytest>=7.0.0" in args["install_requires"]
        assert "pytest-asyncio>=0.18.0" in args["install_requires"]
        assert "pytest-cov>=3.0.0" in args["install_requires"]


def test_setup_imports():
    """Test setup.py imports"""
    # 读取setup.py内容
    with open("setup.py", "r") as f:
        content = f.read()

    # 验证导入语句
    assert "from setuptools import setup, find_packages" in content


def test_find_packages():
    """Test that find_packages finds the correct packages"""
    # 获取当前目录下的所有包
    packages = find_packages(where=".")

    # 验证关键包的存在
    assert len(packages) > 0
    assert any("models" in pkg for pkg in packages) or any(
        "shared" in pkg for pkg in packages
    )

    # 验证主要包的存在
    main_packages = ["models", "shared", "tests"]
    for pkg in main_packages:
        assert any(
            p.startswith(pkg) or p.endswith(pkg) for p in packages
        ), f"Package {pkg} not found"
