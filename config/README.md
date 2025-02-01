# Config

## 目录说明
该目录用于存放项目配置文件。

## 目录结构
```
config/
├── docker/        # Docker相关配置
├── env/          # 环境变量配置
└── db/           # 数据库配置
```

## 配置说明
1. 开发环境配置
   - `.env.development`
   - `docker-compose.dev.yml`
   
2. 生产环境配置
   - `.env.production`
   - `docker-compose.prod.yml`
   
3. 测试环境配置
   - `.env.test`
   - `docker-compose.test.yml`

## 使用说明
1. 不要在代码中硬编码配置项
2. 敏感信息使用环境变量
3. 遵循配置分离原则

## 配置项管理
1. 环境变量
   - 使用 `.env` 文件管理
   - 区分不同环境
   - 敏感信息加密存储

2. Docker配置
   - 容器配置
   - 网络配置
   - 数据卷配置

3. 数据库配置
   - 连接信息
   - 索引配置
   - 备份策略

## 安全注意事项
1. 不要提交敏感配置到版本控制
2. 使用配置模板
3. 定期轮换密钥
4. 最小权限原则 