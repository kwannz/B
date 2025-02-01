import os
from pathlib import Path

import pytest

# 项目根目录
PROJECT_ROOT = Path(__file__).parent.parent.parent

# 必需的目录结构
REQUIRED_DIRECTORIES = [
    # Frontend
    "src/frontend/public",
    "src/frontend/src/components",
    "src/frontend/src/features/dex",
    "src/frontend/src/features/memecoins",
    "src/frontend/src/shared",
    # Backend
    "src/backend/core/strategies",
    "src/backend/core/risk",
    "src/backend/services/dex",
    "src/backend/services/memecoins",
    "src/backend/api",
    "src/backend/infrastructure/database",
    "src/backend/infrastructure/cache",
    # Shared
    "src/shared/types",
    "src/shared/utils",
    "src/shared/config",
    # Docs
    "docs/architecture",
    "docs/api",
    "docs/development",
    # Config
    "config/env",
    "config/strategies",
    # Scripts
    "scripts/deployment",
    "scripts/migration",
    "scripts/tools",
]

# 必需的文件
REQUIRED_FILES = [
    # Backend
    "src/backend/core/__init__.py",
    "src/backend/services/dex/__init__.py",
    "src/backend/services/memecoins/__init__.py",
    # Frontend
    "src/frontend/package.json",
    "src/frontend/tsconfig.json",
    # Config
    "config/README.md",
    ".gitignore",
    # Docs
    "docs/architecture/README.md",
    "docs/api/README.md",
    "docs/development/README.md",
]


def test_required_directories_exist():
    """验证所有必需的目录都存在"""
    for directory in REQUIRED_DIRECTORIES:
        path = PROJECT_ROOT / directory
        assert path.exists(), f"目录不存在: {directory}"
        assert path.is_dir(), f"不是目录: {directory}"


def test_required_files_exist():
    """验证所有必需的文件都存在"""
    for file in REQUIRED_FILES:
        path = PROJECT_ROOT / file
        assert path.exists(), f"文件不存在: {file}"
        assert path.is_file(), f"不是文件: {file}"


def test_no_empty_directories():
    """验证没有空目录"""
    for directory in REQUIRED_DIRECTORIES:
        path = PROJECT_ROOT / directory
        if path.exists():
            assert any(path.iterdir()), f"目录为空: {directory}"


def test_no_duplicate_docs():
    """验证没有重复的文档文件"""
    doc_patterns = ["workflow.md", "deployment.md", "development.md"]
    docs_dir = PROJECT_ROOT / "docs"

    for pattern in doc_patterns:
        matches = list(docs_dir.rglob(pattern))
        assert len(matches) <= 1, f"发现重复文档 {pattern}: {[str(m) for m in matches]}"


def test_frontend_structure():
    """验证前端项目结构"""
    frontend_dir = PROJECT_ROOT / "src/frontend"

    # 检查package.json中的依赖
    with open(frontend_dir / "package.json") as f:
        import json

        package = json.load(f)
        assert "dependencies" in package
        assert "devDependencies" in package

        # 检查必需的依赖
        required_deps = ["react", "typescript", "tailwindcss"]
        for dep in required_deps:
            assert dep in package["dependencies"] or dep in package["devDependencies"]


def test_backend_structure():
    """验证后端项目结构"""
    backend_dir = PROJECT_ROOT / "src/backend"

    # 检查Python包结构
    assert (backend_dir / "__init__.py").exists()
    assert (backend_dir / "requirements.txt").exists()

    # 检查服务模块
    services_dir = backend_dir / "services"
    for service in ["dex", "memecoins"]:
        service_dir = services_dir / service
        assert (service_dir / "__init__.py").exists()
        assert (service_dir / "service.py").exists() or (
            service_dir / "main.py"
        ).exists()


def test_documentation_structure():
    """验证文档结构"""
    docs_dir = PROJECT_ROOT / "docs"

    # 检查README文件
    for subdir in ["architecture", "api", "development"]:
        readme = docs_dir / subdir / "README.md"
        assert readme.exists()

        # 检查README内容
        content = readme.read_text()
        assert len(content.strip()) > 0, f"{subdir}/README.md 是空的"
        assert "# " in content, f"{subdir}/README.md 缺少标题"


def test_config_structure():
    """验证配置结构"""
    config_dir = PROJECT_ROOT / "config"

    # 检查环境配置
    env_dir = config_dir / "env"
    assert (env_dir / ".env.example").exists()

    # 检查策略配置
    strategies_dir = config_dir / "strategies"
    assert any(strategies_dir.glob("*.json") or strategies_dir.glob("*.yaml"))
