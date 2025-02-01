# 测试文档

本目录包含TradingBot的所有测试用例和测试工具。

## 📁 测试结构

```
tests/
├── unit/           # 单元测试
│   ├── data/      # 数据处理测试
│   ├── features/  # 特征工程测试
│   └── system/    # 系统核心测试
├── integration/    # 集成测试
│   ├── api/       # API测试
│   └── workflow/  # 工作流测试
├── local/         # 本地测试
├── backend/       # 后端测试
├── data/          # 测试数据
└── docker-compose.test.yml  # 测试环境配置
```

## 🧪 测试类型

### 1. 单元测试 (unit/)

测试独立组件和函数:
- 数据处理器测试
- 特征计算器测试
- 工具函数测试
- 模型组件测试

运行方式:
```bash
# 运行所有单元测试
pytest tests/unit/

# 运行特定模块测试
pytest tests/unit/data/
pytest tests/unit/features/
pytest tests/unit/system/
```

### 2. 集成测试 (integration/)

测试组件间交互:
- API集成测试
- 数据流测试
- 工作流测试
- 系统集成测试

运行方式:
```bash
# 运行所有集成测试
pytest tests/integration/

# 运行特定集成测试
pytest tests/integration/api/
pytest tests/integration/workflow/
```

### 3. 本地测试 (local/)

本地环境测试:
- 环境配置测试
- 部署测试
- 性能测试

运行方式:
```bash
# 运行本地测试
pytest tests/local/
```

## 🛠 测试工具

### 测试框架
- Python: pytest
- Go: testing
- 前端: Jest + React Testing Library

### 测试辅助工具
- pytest-cov: 代码覆盖率
- pytest-mock: 模拟和存根
- pytest-asyncio: 异步测试
- pytest-benchmark: 性能测试

## 📊 测试覆盖率

目标覆盖率:
- 单元测试: > 80%
- 集成测试: > 70%
- 总体覆盖率: > 75%

生成覆盖率报告:
```bash
# 生成HTML报告
pytest --cov=src --cov-report=html

# 生成XML报告
pytest --cov=src --cov-report=xml
```

## 🔍 测试规范

### 1. 命名规范

- 测试文件: `test_*.py`
- 测试类: `Test*`
- 测试方法: `test_*`
- 测试数据: `*_test_data.json`

### 2. 测试结构

```python
# 测试类模板
class TestComponent:
    @pytest.fixture
    def setup_component(self):
        # 设置测试环境
        pass
    
    def test_functionality(self, setup_component):
        # 测试具体功能
        pass
    
    @pytest.mark.parametrize(...)
    def test_with_parameters(self, param):
        # 参数化测试
        pass
```

### 3. 测试原则

- 单一职责
- 独立性
- 可重复性
- 简单明了
- 有意义的断言

## 🔄 持续集成

### GitHub Actions配置
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run Tests
        run: |
          python -m pytest
```

### 本地CI运行
```bash
# 运行所有测试
./scripts/run_tests.sh

# 运行带覆盖率的测试
./scripts/run_tests.sh --coverage
```

## 📝 测试文档

### 1. 测试用例文档
```python
def test_feature():
    """
    测试特征计算功能
    
    步骤:
    1. 准备测试数据
    2. 调用特征计算
    3. 验证计算结果
    
    预期结果:
    - 返回正确的特征值
    - 处理边界情况
    - 处理异常输入
    """
    pass
```

### 2. 测试数据准备
```python
@pytest.fixture
def sample_data():
    """
    准备测试数据
    
    返回:
    - 市场数据样本
    - 预期结果
    """
    return {
        'input': {...},
        'expected': {...}
    }
```

## 🐛 故障排除

### 常见问题

1. 测试超时
```bash
# 增加超时时间
pytest --timeout=300
```

2. 资源清理
```python
@pytest.fixture(autouse=True)
def cleanup():
    # 测试前设置
    yield
    # 测试后清理
```

3. 数据库重置
```bash
# 重置测试数据库
./scripts/reset_test_db.sh
```

## 📈 性能测试

### 基准测试
```python
@pytest.mark.benchmark
def test_performance(benchmark):
    benchmark(function_to_test)
```

### 负载测试
```bash
# 运行负载测试
./scripts/load_test.sh
```

## 🔒 安全测试

### 安全扫描
```bash
# 运行安全测试
./scripts/security_test.sh
```

### 渗透测试
```bash
# 运行渗透测试
./scripts/pentest.sh
