# Contributing Guide

## 如何贡献

感谢你考虑为本项目做出贡献！以下是一些指南，帮助你更好地参与项目开发。

## 开发流程

1. Fork 项目仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 分支管理

- `main`: 主分支，用于发布
- `develop`: 开发分支，最新的开发代码
- `feature/*`: 特性分支，用于开发新功能
- `bugfix/*`: 修复分支，用于修复bug
- `release/*`: 发布分支，用于版本发布

## 提交规范

使用语义化的提交消息：

```
<type>(<scope>): <subject>

<body>

<footer>
```

类型（type）：
- feat: 新功能
- fix: 修复bug
- docs: 文档更新
- style: 代码格式调整
- refactor: 重构
- test: 测试相关
- chore: 构建过程或辅助工具的变动

## 代码规范

1. 前端
   - 使用 ESLint + Prettier
   - 遵循 React 最佳实践
   - 使用 TypeScript
   - 组件文档使用 Storybook

2. 后端
   - 使用 Black + isort
   - 遵循 PEP 8
   - 类型注解
   - API文档使用 OpenAPI

## 测试要求

1. 新功能必须包含测试
2. 修复bug必须包含测试用例
3. 保持测试覆盖率
4. 所有测试必须通过

## 文档要求

1. 更新相关文档
2. 添加必要的注释
3. 更新 CHANGELOG
4. 更新 API 文档

## Review 流程

1. 至少需要一个审核人
2. CI 检查必须通过
3. 所有评论必须解决
4. 遵循 Review 清单

## 发布流程

1. 更新版本号
2. 更新 CHANGELOG
3. 创建发布分支
4. 执行测试
5. 合并到主分支
6. 创建 Tag

## 帮助和支持

如果你需要帮助：
1. 查看文档
2. 提交 Issue
3. 加入讨论组
4. 联系维护者 