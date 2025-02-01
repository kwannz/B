# 贡献指南

感谢您对本项目的关注！我们欢迎所有形式的贡献，包括但不限于：

- 代码贡献
- 文档改进
- Bug报告
- 功能建议
- 代码审查
- 测试用例

## 目录

- [开发环境设置](#开发环境设置)
- [代码风格](#代码风格)
- [提交流程](#提交流程)
- [分支策略](#分支策略)
- [测试指南](#测试指南)
- [文档规范](#文档规范)
- [版本发布](#版本发布)
- [问题反馈](#问题反馈)

## 开发环境设置

1. Fork本仓库
2. 克隆你的Fork:
   ```bash
   git clone https://github.com/your-username/tradingbot.git
   cd tradingbot
   ```

3. 安装依赖:
   ```bash
   # 安装系统依赖
   brew install protobuf  # macOS
   # 或
   sudo apt-get install protobuf-compiler python3-dev  # Ubuntu

   # 创建虚拟环境
   python3.11 -m venv venv311
   source venv311/bin/activate

   # 安装Python依赖
   pip install -r src/python/requirements.txt

   # 安装Go依赖
   cd src/go
   go mod download
   ```

4. 设置pre-commit hooks:
   ```bash
   pip install pre-commit
   pre-commit install
   ```

## 代码风格

### Python代码风格

- 遵循PEP 8规范
- 使用Black进行代码格式化
- 使用isort排序导入
- 使用pylint进行代码检查
- 使用mypy进行类型检查

```bash
# 格式化代码
black src/python
isort src/python

# 代码检查
pylint src/python
mypy src/python
```

### Go代码风格

- 遵循Go官方代码规范
- 使用gofmt格式化代码
- 使用golangci-lint进行代码检查

```bash
# 格式化代码
gofmt -w src/go

# 代码检查
golangci-lint run
```

### 注释规范

- 所有公共API必须有文档字符串
- 复杂的逻辑必须有详细注释
- 使用英文编写注释
- 保持注释的及时更新

## 提交流程

1. 创建新分支:
   ```bash
   git checkout -b feature/your-feature
   # 或
   git checkout -b fix/your-bugfix
   ```

2. 进行修改并提交:
   ```bash
   git add .
   git commit -m "feat: add new feature"  # 或 "fix: fix bug"
   ```

3. 推送到你的Fork:
   ```bash
   git push origin feature/your-feature
   ```

4. 创建Pull Request

### 提交消息规范

使用[Conventional Commits](https://www.conventionalcommits.org/)规范:

- feat: 新功能
- fix: 修复bug
- docs: 文档更新
- style: 代码风格修改
- refactor: 代码重构
- test: 测试相关
- chore: 构建过程或辅助工具的变动

## 分支策略

- main: 主分支，保持稳定
- develop: 开发分支
- feature/*: 新功能分支
- fix/*: 修复分支
- release/*: 发布分支

## 测试指南

1. 运行测试:
   ```bash
   # 运行所有测试
   ./src/scripts/run_tests.sh

   # 运行特定测试
   pytest tests/python/test_specific.py
   ```

2. 编写测试:
   - 单元测试覆盖所有公共API
   - 集成测试覆盖主要功能流程
   - 使用pytest fixtures和mock
   - 保持测试简单和独立

## 文档规范

1. 更新文档:
   - README.md: 项目概述和快速开始
   - docs/*.md: 详细文档
   - 代码注释: 函数和类的文档字符串

2. 文档结构:
   - 清晰的标题层次
   - 代码示例
   - 配置说明
   - 故障排除指南

## 版本发布

1. 更新版本号:
   - 遵循语义化版本
   - 更新CHANGELOG.md
   - 更新文档版本引用

2. 创建发布:
   ```bash
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin v1.0.0
   ```

## 问题反馈

1. 提交Issue:
   - 使用Issue模板
   - 提供详细的复现步骤
   - 包含环境信息
   - 附加相关日志

2. 安全问题:
   - 不要公开提交
   - 发送邮件到security@example.com

## 行为准则

- 尊重所有贡献者
- 保持专业和友善
- 接受建设性批评
- 关注问题本身

## 许可证

贡献代码即表示您同意您的贡献将使用MIT许可证。

## 联系方式

- 邮件: support@example.com
- Discord: [加入社区](https://discord.gg/yourserver)
- GitHub Issues: [提交问题](https://github.com/yourusername/tradingbot/issues)

感谢您的贡献！
