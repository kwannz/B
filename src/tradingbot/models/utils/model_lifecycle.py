import json
import logging
import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml


@dataclass
class ModelVersion:
    """模型版本信息"""

    version: str
    created_at: datetime
    metrics: Dict[str, Any]
    status: str
    deployed: bool


class ModelLifecycleManager:
    """模型生命周期管理工具类"""

    def __init__(
        self,
        model_name: str,
        artifacts_dir: str = "models/artifacts",
        config_dir: str = "models/config",
        max_versions: int = 5,
    ):
        self.model_name = model_name
        self.artifacts_dir = Path(artifacts_dir)
        self.config_dir = Path(config_dir)
        self.max_versions = max_versions
        self.logger = logging.getLogger(__name__)

        # 创建必要的目录
        self.artifacts_dir.mkdir(parents=True, exist_ok=True)
        self.config_dir.mkdir(parents=True, exist_ok=True)

        # 加载模型配置
        self.config = self._load_config()

        # 初始化版本信息
        self.versions = self._load_versions()

    def register_model(
        self,
        model_path: str,
        version: str,
        metrics: Dict[str, Any],
        config: Dict[str, Any],
    ) -> ModelVersion:
        """注册新模型版本"""
        try:
            # 验证版本号
            if version in self.versions:
                raise ValueError(f"版本 {version} 已存在")

            # 复制模型文件
            target_path = self.artifacts_dir / f"{self.model_name}_v{version}.joblib"
            shutil.copy2(model_path, target_path)

            # 创建版本信息
            model_version = ModelVersion(
                version=version,
                created_at=datetime.now(),
                metrics=metrics,
                status="registered",
                deployed=False,
            )

            # 更新配置
            self.config.update(config)
            self._save_config()

            # 保存版本信息
            self.versions[version] = model_version
            self._save_versions()

            # 清理旧版本
            self._cleanup_old_versions()

            return model_version

        except Exception as e:
            self.logger.error(f"模型注册失败: {str(e)}")
            raise

    def deploy_model(self, version: str) -> ModelVersion:
        """部署指定版本模型"""
        try:
            if version not in self.versions:
                raise ValueError(f"版本 {version} 不存在")

            # 更新部署状态
            for v in self.versions.values():
                v.deployed = False

            model_version = self.versions[version]
            model_version.deployed = True
            model_version.status = "deployed"

            # 创建部署符号链接
            deploy_link = self.artifacts_dir / f"{self.model_name}_latest.joblib"
            if deploy_link.exists():
                deploy_link.unlink()
            deploy_link.symlink_to(
                self.artifacts_dir / f"{self.model_name}_v{version}.joblib"
            )

            # 保存版本信息
            self._save_versions()

            return model_version

        except Exception as e:
            self.logger.error(f"模型部署失败: {str(e)}")
            raise

    def rollback_model(self, version: str) -> ModelVersion:
        """回滚到指定版本"""
        try:
            if version not in self.versions:
                raise ValueError(f"版本 {version} 不存在")

            # 检查版本状态
            model_version = self.versions[version]
            if model_version.status not in ["registered", "archived"]:
                raise ValueError(f"版本 {version} 状态不允许回滚")

            # 执行部署
            return self.deploy_model(version)

        except Exception as e:
            self.logger.error(f"模型回滚失败: {str(e)}")
            raise

    def archive_model(self, version: str) -> ModelVersion:
        """归档指定版本模型"""
        try:
            if version not in self.versions:
                raise ValueError(f"版本 {version} 不存在")

            model_version = self.versions[version]
            if model_version.deployed:
                raise ValueError(f"版本 {version} 当前已部署，无法归档")

            # 更新状态
            model_version.status = "archived"
            self._save_versions()

            return model_version

        except Exception as e:
            self.logger.error(f"模型归档失败: {str(e)}")
            raise

    def get_model_info(self, version: Optional[str] = None) -> Dict[str, Any]:
        """获取模型信息"""
        if version is None:
            # 返回当前部署版本
            deployed_versions = [v for v in self.versions.values() if v.deployed]
            if not deployed_versions:
                raise ValueError("没有已部署的模型版本")
            version = deployed_versions[0].version

        if version not in self.versions:
            raise ValueError(f"版本 {version} 不存在")

        model_version = self.versions[version]
        return {
            "name": self.model_name,
            "version": version,
            "created_at": model_version.created_at.isoformat(),
            "status": model_version.status,
            "deployed": model_version.deployed,
            "metrics": model_version.metrics,
            "config": self.config,
        }

    def list_versions(self) -> List[Dict[str, Any]]:
        """列出所有版本信息"""
        return [
            {
                "version": v.version,
                "created_at": v.created_at.isoformat(),
                "status": v.status,
                "deployed": v.deployed,
                "metrics": v.metrics,
            }
            for v in sorted(
                self.versions.values(), key=lambda x: x.created_at, reverse=True
            )
        ]

    def _load_config(self) -> Dict[str, Any]:
        """加载模型配置"""
        config_path = self.config_dir / f"{self.model_name}_config.yaml"
        if not config_path.exists():
            return {}

        with open(config_path, "r") as f:
            return yaml.safe_load(f)

    def _save_config(self):
        """保存模型配置"""
        config_path = self.config_dir / f"{self.model_name}_config.yaml"
        with open(config_path, "w") as f:
            yaml.safe_dump(self.config, f)

    def _load_versions(self) -> Dict[str, ModelVersion]:
        """加载版本信息"""
        versions_path = self.config_dir / f"{self.model_name}_versions.json"
        if not versions_path.exists():
            return {}

        with open(versions_path, "r") as f:
            versions_data = json.load(f)

        return {
            version: ModelVersion(
                version=version,
                created_at=datetime.fromisoformat(data["created_at"]),
                metrics=data["metrics"],
                status=data["status"],
                deployed=data["deployed"],
            )
            for version, data in versions_data.items()
        }

    def _save_versions(self):
        """保存版本信息"""
        versions_path = self.config_dir / f"{self.model_name}_versions.json"
        versions_data = {
            version: {
                "version": v.version,
                "created_at": v.created_at.isoformat(),
                "metrics": v.metrics,
                "status": v.status,
                "deployed": v.deployed,
            }
            for version, v in self.versions.items()
        }

        with open(versions_path, "w") as f:
            json.dump(versions_data, f, indent=2)

    def _cleanup_old_versions(self):
        """清理旧版本"""
        if len(self.versions) <= self.max_versions:
            return

        # 按创建时间排序
        sorted_versions = sorted(self.versions.items(), key=lambda x: x[1].created_at)

        # 保留最新的版本和已部署的版本
        versions_to_keep = set(
            v.version
            for v in self.versions.values()
            if v.deployed or v.status == "deployed"
        )
        versions_to_keep.update(
            v.version for _, v in sorted_versions[-self.max_versions :]
        )

        # 删除旧版本
        for version, model_version in sorted_versions:
            if version not in versions_to_keep:
                model_path = self.artifacts_dir / f"{self.model_name}_v{version}.joblib"
                if model_path.exists():
                    model_path.unlink()
                del self.versions[version]

        self._save_versions()
