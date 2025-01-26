# Trading Bot 系统重构计划 - 剩余任务

## 1. FastAPI实现 [待完成]

### 1.1 API结构
- [ ] 创建 src/api/ 目录
- [ ] 实现 main.py (FastAPI应用)
- [ ] 创建路由目录 src/api/routers/
  * market.py
  * trading.py
  * risk.py
  * strategy.py
  * monitor.py

### 1.2 数据模型
- [ ] 创建 src/api/models/ 目录
  * market.py
  * trade.py
  * risk.py
  * response.py

### 1.3 依赖注入
- [ ] 实现 deps.py
- [ ] 添加数据库连接依赖
- [ ] 添加缓存依赖
- [ ] 添加认证依赖

## 2. Docker集成测试 [待完成]
- [ ] 添加容器化服务测试
- [ ] 测试服务间通信
- [ ] 验证扩展和故障转移

## 3. API测试套件 [待完成]
- [ ] 市场API测试
- [ ] 交易API测试
- [ ] 风险API测试
- [ ] 监控API测试

## 4. 测试覆盖目标 [待完成]
- [ ] 单元测试覆盖率 > 90%
- [ ] 集成测试覆盖率 > 80%
- [ ] 关键功能100%覆盖

## 执行优先级

1. FastAPI实现
   - 创建API结构和路由
   - 实现数据模型
   - 设置依赖注入系统

2. Docker集成测试
   - 实现容器化服务测试
   - 验证服务通信
   - 测试扩展性能

3. API测试套件
   - 实现API端点测试
   - 达到覆盖率目标
   - 验证错误处理
