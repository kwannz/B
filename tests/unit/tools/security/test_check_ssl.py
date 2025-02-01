import importlib.util
import os
import ssl


def test_check_ssl(capsys):
    """Test that check_ssl.py can be executed and prints SSL version"""
    # 获取check_ssl.py的路径
    check_ssl_path = os.path.join(os.getcwd(), "check_ssl.py")

    # 动态导入模块
    spec = importlib.util.spec_from_file_location("check_ssl", check_ssl_path)
    check_ssl = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(check_ssl)

    # 捕获输出
    captured = capsys.readouterr()

    # 验证输出
    assert "SSL Version:" in captured.out
    assert ssl.OPENSSL_VERSION in captured.out
