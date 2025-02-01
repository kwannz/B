# Tests

## 目录说明
该目录用于存放所有测试相关代码。

## 目录结构
```
tests/
├── unit/          # 单元测试
│   ├── frontend/  # 前端单元测试
│   └── backend/   # 后端单元测试
├── integration/   # 集成测试
│   ├── frontend/  # 前端集成测试
│   └── backend/   # 后端集成测试
└── e2e/          # 端到端测试
```

## 测试框架
1. 前端: Jest + React Testing Library
2. 后端: Pytest
3. E2E: Cypress

## 目录说明
- `unit/`: 单元测试，测试独立组件和函数
- `integration/`: 集成测试，测试组件间交互
- `e2e/`: 端到端测试，测试完整业务流程

## 测试规范
1. 单元测试覆盖率要求 > 80%
2. 集成测试覆盖主要业务流程
3. E2E测试覆盖关键用户场景
4. 使用测试夹具(fixtures)管理测试数据
5. 模拟外部依赖和API调用

## 运行测试
```bash
# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration

# 运行E2E测试
npm run test:e2e

# 运行所有测试
npm test
```

## 最佳实践
1. 遵循 AAA (Arrange-Act-Assert) 模式
2. 使用有意义的测试描述
3. 一个测试只测试一个概念
4. 保持测试的独立性和可重复性 