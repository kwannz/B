import os
import pathlib
import tarfile
import tempfile

import pytest

from src.tarsafe import TarSafe, TarSafeException


@pytest.fixture
def temp_dir():
    with tempfile.TemporaryDirectory() as td:
        original_dir = os.getcwd()
        os.chdir(td)
        yield td
        os.chdir(original_dir)


def create_tar_with_file(filename, content):
    with open(filename, "w") as f:
        f.write(content)
    with tarfile.open("test.tar", "w") as tar:
        tar.add(filename)
    return "test.tar"


def test_normal_tar_extraction(temp_dir):
    # 测试正常的tar文件解压
    tar_file = create_tar_with_file("test.txt", "Hello World")
    with TarSafe.open(tar_file) as tar:
        tar.extractall()
    assert os.path.exists("test.txt")
    with open("test.txt") as f:
        assert f.read() == "Hello World"


def test_directory_traversal_detection(temp_dir):
    # 测试目录遍历攻击检测
    with open("test.txt", "w") as f:
        f.write("malicious")
    with tarfile.open("test.tar", "w") as tar:
        tar.add("test.txt", "../../../../../etc/passwd")

    with pytest.raises(TarSafeException) as exc:
        with TarSafe.open("test.tar") as tar:
            tar.extractall()
    assert "Attempted directory traversal for member: ../../../../../etc/passwd" in str(
        exc.value
    )


def test_unsafe_symlink_detection(temp_dir):
    # 测试不安全的符号链接检测
    if os.name != "nt":  # Skip on Windows
        os.symlink("/etc/passwd", "evil_link")
        with tarfile.open("test.tar", "w") as tar:
            tar.add("evil_link")

        with pytest.raises(TarSafeException) as exc:
            with TarSafe.open("test.tar") as tar:
                tar.extractall()
        assert "Attempted directory traversal via symlink" in str(exc.value)


def test_safe_symlink_detection(temp_dir):
    # 测试安全的符号链接（指向当前目录内的文件）
    if os.name != "nt":  # Skip on Windows
        with open("target.txt", "w") as f:
            f.write("safe data")
        os.symlink("target.txt", "safe_link")
        with tarfile.open("test.tar", "w") as tar:
            tar.add("safe_link")

        # 这个符号链接是安全的，不应该抛出异常
        with TarSafe.open("test.tar") as tar:
            tar.extractall()

        # 验证链接被正确提取
        assert os.path.exists("safe_link")
        with open("target.txt") as f:
            assert f.read() == "safe data"


def test_unsafe_link_detection(temp_dir):
    # 测试不安全的硬链接检测
    with open("target.txt", "w") as f:
        f.write("test data")

    if os.name != "nt":  # Skip on Windows
        # 创建一个包含硬链接的tar文件
        with tarfile.open("test.tar", "w") as tar:
            info = tarfile.TarInfo("evil_link")
            info.type = tarfile.LNKTYPE  # 设置为硬链接
            info.linkname = "../outside/sensitive.txt"  # 指向外部文件
            info.size = 0
            tar.addfile(info)

        with pytest.raises(TarSafeException) as exc:
            with TarSafe.open("test.tar") as tar:
                tar.extractall()
        assert (
            "Attempted directory traversal via link for member: ../outside/sensitive.txt"
            in str(exc.value)
        )


def test_safe_link_detection(temp_dir):
    # 测试安全的硬链接（指向当前目录内的文件）
    if os.name != "nt":  # Skip on Windows
        with open("source.txt", "w") as f:
            f.write("safe data")

        with tarfile.open("test.tar", "w") as tar:
            info = tarfile.TarInfo("safe_link")
            info.type = tarfile.LNKTYPE
            info.linkname = "source.txt"
            info.size = 0
            tar.addfile(info)

        # 这个硬链接是安全的，不应该抛出异常
        with TarSafe.open("test.tar") as tar:
            tar.extractall()
        assert os.path.exists("safe_link")


def test_device_file_detection(temp_dir):
    # 创建一个模拟设备文件的tar
    with tarfile.open("test.tar", "w") as tar:
        device_info = tarfile.TarInfo("device")
        device_info.type = tarfile.CHRTYPE  # 字符设备
        tar.addfile(device_info)

    with pytest.raises(TarSafeException) as exc:
        with TarSafe.open("test.tar") as tar:
            tar.extractall()
    assert "tarfile returns true for isblk() or ischr()" in str(exc.value)


def test_error_handling(temp_dir):
    # 测试一般错误处理
    with pytest.raises(Exception):
        with TarSafe.open("nonexistent.tar") as tar:
            tar.extractall()
