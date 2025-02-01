from typing import Dict, List, Any, Optional
import subprocess
import sys
import os
from pathlib import Path
import logging
import yaml
import json
from packaging import version


class ModelEnvironment:
    """模型环境管理工具类"""

    def __init__(
        self,
        environment_name: str,
        config_dir: str = "models/config",
        requirements_file: str = "requirements.txt",
        environment_file: str = "environment.yaml",
    ):
        self.environment_name = environment_name
        self.config_dir = Path(config_dir)
        self.requirements_file = self.config_dir / requirements_file
        self.environment_file = self.config_dir / environment_file
        self.logger = logging.getLogger(__name__)

        # 创建配置目录
        self.config_dir.mkdir(parents=True, exist_ok=True)

        # 加载环境配置
        self.config = self._load_environment_config()

        # 初始化依赖信息
        self.dependencies = self._load_dependencies()

    def setup_environment(self) -> bool:
        """设置模型运行环境"""
        try:
            # 检查Python版本
            if not self._check_python_version():
                raise RuntimeError("Python版本不满足要求")

            # 安装依赖
            self._install_dependencies()

            # 设置环境变量
            self._setup_environment_variables()

            # 验证环境
            self._validate_environment()

            return True

        except Exception as e:
            self.logger.error(f"环境设置失败: {str(e)}")
            return False

    def export_environment(self, output_dir: str):
        """导出环境配置"""
        try:
            output_path = Path(output_dir)
            output_path.mkdir(parents=True, exist_ok=True)

            # 导出依赖
            self._export_dependencies(output_path)

            # 导出环境配置
            self._export_environment_config(output_path)

            # 导出环境变量
            self._export_environment_variables(output_path)

        except Exception as e:
            self.logger.error(f"环境导出失败: {str(e)}")
            raise

    def validate_dependencies(self) -> Dict[str, bool]:
        """验证依赖包版本"""
        validation_results = {}

        try:
            import pkg_resources

            for package, required_version in self.dependencies.get(
                "packages", {}
            ).items():
                try:
                    installed_version = pkg_resources.get_distribution(package).version
                    meets_requirement = self._check_version_requirement(
                        installed_version, required_version
                    )
                    validation_results[package] = meets_requirement
                except pkg_resources.DistributionNotFound:
                    validation_results[package] = False

            return validation_results

        except Exception as e:
            self.logger.error(f"依赖验证失败: {str(e)}")
            raise

    def _load_environment_config(self) -> Dict[str, Any]:
        """加载环境配置"""
        if not self.environment_file.exists():
            return {
                "name": self.environment_name,
                "python_version": f">={sys.version_info.major}.{sys.version_info.minor}",
                "environment_variables": {},
                "cuda_required": False,
                "memory_requirement": "2GB",
                "disk_requirement": "5GB",
            }

        with open(self.environment_file, "r") as f:
            return yaml.safe_load(f)

    def _load_dependencies(self) -> Dict[str, Any]:
        """加载依赖信息"""
        if not self.requirements_file.exists():
            return {"packages": {}}

        packages = {}
        with open(self.requirements_file, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    package_info = line.split("==")
                    if len(package_info) == 2:
                        packages[package_info[0]] = f"=={package_info[1]}"
                    else:
                        package_info = line.split(">=")
                        if len(package_info) == 2:
                            packages[package_info[0]] = f">={package_info[1]}"
                        else:
                            packages[line] = "latest"

        return {"packages": packages}

    def _check_python_version(self) -> bool:
        """检查Python版本"""
        required_version = self.config.get("python_version", "")
        if not required_version:
            return True

        current_version = f"{sys.version_info.major}.{sys.version_info.minor}"
        return self._check_version_requirement(current_version, required_version)

    def _check_version_requirement(
        self, current_version: str, required_version: str
    ) -> bool:
        """检查版本要求"""
        try:
            if required_version.startswith(">="):
                return version.parse(current_version) >= version.parse(
                    required_version[2:]
                )
            elif required_version.startswith("=="):
                return version.parse(current_version) == version.parse(
                    required_version[2:]
                )
            elif required_version == "latest":
                return True
            else:
                return version.parse(current_version) >= version.parse(required_version)
        except Exception:
            return False

    def _install_dependencies(self):
        """安装依赖包"""
        packages = self.dependencies.get("packages", {})
        if not packages:
            return

        try:
            for package, required_version in packages.items():
                if required_version == "latest":
                    cmd = [sys.executable, "-m", "pip", "install", "--upgrade", package]
                else:
                    cmd = [
                        sys.executable,
                        "-m",
                        "pip",
                        "install",
                        f"{package}{required_version}",
                    ]

                subprocess.check_call(cmd)

        except subprocess.CalledProcessError as e:
            self.logger.error(f"依赖安装失败: {str(e)}")
            raise

    def _setup_environment_variables(self):
        """设置环境变量"""
        env_vars = self.config.get("environment_variables", {})
        for name, value in env_vars.items():
            os.environ[name] = str(value)

    def _validate_environment(self):
        """验证环境配置"""
        # 验证CUDA
        if self.config.get("cuda_required", False):
            try:
                import torch

                if not torch.cuda.is_available():
                    raise RuntimeError("CUDA不可用")
            except ImportError:
                raise RuntimeError("PyTorch未安装")

        # 验证内存
        import psutil

        memory_requirement = self._parse_size(
            self.config.get("memory_requirement", "2GB")
        )
        available_memory = psutil.virtual_memory().available
        if available_memory < memory_requirement:
            raise RuntimeError("可用内存不足")

        # 验证磁盘空间
        disk_requirement = self._parse_size(self.config.get("disk_requirement", "5GB"))
        available_disk = psutil.disk_usage("/").free
        if available_disk < disk_requirement:
            raise RuntimeError("可用磁盘空间不足")

    def _parse_size(self, size_str: str) -> int:
        """解析大小字符串"""
        units = {
            "B": 1,
            "KB": 1024,
            "MB": 1024 * 1024,
            "GB": 1024 * 1024 * 1024,
            "TB": 1024 * 1024 * 1024 * 1024,
        }

        size = size_str.strip()
        for unit, multiplier in units.items():
            if size.endswith(unit):
                try:
                    return int(float(size[: -len(unit)]) * multiplier)
                except ValueError:
                    continue
        return 0

    def _export_dependencies(self, output_path: Path):
        """导出依赖信息"""
        requirements_path = output_path / "requirements.txt"
        with open(requirements_path, "w") as f:
            for package, version in self.dependencies.get("packages", {}).items():
                f.write(f"{package}{version}\n")

    def _export_environment_config(self, output_path: Path):
        """导出环境配置"""
        config_path = output_path / "environment.yaml"
        with open(config_path, "w") as f:
            yaml.safe_dump(self.config, f)

    def _export_environment_variables(self, output_path: Path):
        """导出环境变量"""
        env_path = output_path / "environment.env"
        with open(env_path, "w") as f:
            for name, value in self.config.get("environment_variables", {}).items():
                f.write(f"{name}={value}\n")
