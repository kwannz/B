# Trading Bot Debug System

本调试系统提供了全面的调试和监控功能,支持中英文双语界面。

## 主要组件

### 1. 调试面板 (DebugPanel)
- 显示调试日志、错误和警告
- 支持日志过滤和搜索
- 提供日志导出功能 (JSON/CSV)
- 实时更新日志信息

### 2. 性能指标 (DebugMetrics)
- CPU 和内存使用率
- API 延迟监控
- 活跃交易数量
- 钱包余额监控

### 3. 指标趋势图 (DebugMetricsChart)
- 可视化性能指标趋势
- 支持多种指标切换
- 实时数据更新
- 可调节时间范围

### 4. 调试工具栏 (DebugToolbar)
- 快速访问调试功能
- 错误和警告计数器
- 一键导出日志
- 系统刷新功能

### 5. 错误边界 (DebugErrorBoundary)
- 捕获和显示组件错误
- 错误详细信息展示
- 自动错误日志记录
- 一键刷新功能

## 使用方法

### 开启调试模式
```tsx
// 使用 useDebug hook
const { isDebugMode, toggleDebugMode } = useDebug();

// 切换调试模式
<Button onClick={toggleDebugMode}>
  {isDebugMode ? '关闭调试' : '开启调试'}
</Button>
```

### 记录日志
```tsx
const { log } = useDebug();

// 不同级别的日志
log('debug', 'Category', 'Debug message', { data });
log('info', 'Category', 'Info message', { data });
log('warn', 'Category', 'Warning message', { data });
log('error', 'Category', 'Error message', { data });
```

### 性能监控
```tsx
// 在组件中使用性能指标
<DebugMetrics />

// 使用趋势图
<DebugMetricsChart />

// 完整仪表盘
<DebugMetricsDashboard />
```

### 错误处理
```tsx
// 包装组件以捕获错误
<DebugErrorBoundaryWrapper>
  <YourComponent />
</DebugErrorBoundaryWrapper>
```

## 多语言支持

### 切换语言
```tsx
const { language, setLanguage } = useLanguage();

// 切换语言
<Button onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}>
  Switch Language
</Button>
```

## 最佳实践

1. 错误处理
- 使用 DebugErrorBoundary 包装关键组件
- 在 catch 块中使用 log 记录错误
- 提供有意义的错误信息

2. 性能监控
- 定期检查性能指标
- 设置合理的警告阈值
- 关注趋势变化

3. 日志记录
- 使用适当的日志级别
- 包含相关上下文信息
- 避免记录敏感数据

4. 调试工具
- 合理使用调试工具栏
- 定期导出和分析日志
- 保持界面整洁

## 注意事项

1. 性能影响
- 调试模式可能影响应用性能
- 生产环境建议关闭调试功能
- 合理使用日志级别

2. 安全考虑
- 不要记录敏感信息
- 限制调试功能访问
- 定期清理日志数据

3. 维护建议
- 定期检查和更新调试工具
- 保持文档更新
- 收集用户反馈

## 贡献指南

1. 代码规范
- 遵循 TypeScript 类型定义
- 保持组件独立性
- 编写单元测试

2. 文档要求
- 更新 README
- 添加代码注释
- 提供使用示例

3. 提交流程
- 创建功能分支
- 提交前测试
- 遵循提交规范
