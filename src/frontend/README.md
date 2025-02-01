# Frontend

## 目录说明
该目录用于存放前端相关代码。

## 目录结构
```
frontend/
├── components/     # UI组件
├── pages/         # 页面组件
├── styles/        # 样式文件
├── utils/         # 工具函数
└── tests/         # 前端测试
```

## 开发规范
1. 组件采用 React + TypeScript
2. 样式使用 Tailwind CSS
3. 状态管理使用 React Context + Hooks
4. 测试使用 Jest + React Testing Library

## 目录说明
- `components/`: 可复用的UI组件
- `pages/`: 页面级组件
- `styles/`: 全局样式和主题配置
- `utils/`: 工具函数和通用逻辑
- `tests/`: 单元测试和集成测试

## 开发指南
1. 新增组件时请添加相应的测试
2. 保持组件的单一职责
3. 使用TypeScript类型定义
4. 遵循项目的代码风格指南 