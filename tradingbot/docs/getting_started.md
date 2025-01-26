# Trading Bot 启动指南

本指南将帮助您正确启动和使用交易机器人系统。

## 目录

1. [环境准备](#环境准备)
2. [系统配置](#系统配置)
3. [启动系统](#启动系统)
4. [监控交易](#监控交易)
5. [停止系统](#停止系统)
6. [常见问题](#常见问题)

## 环境准备

### 1. 安装依赖

```bash
# 安装系统依赖
# macOS
brew install python@3.11 go node protobuf

# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y python3.11 golang nodejs protobuf-compiler python3-dev build-essential

# 初始化项目
./src/scripts/init_project.sh
```

### 2. 创建虚拟环境

```bash
# 创建Python虚拟环境
python3.11 -m venv venv311
source venv311/bin/activate

# 安装Python依赖
pip install -r src/python/requirements.txt
```

## 系统配置

### 1. 配置环境变量

```bash
# 复制配置模板
cp config/.env.example config/.env

# 编辑配置文件
vim config/.env
```

必需的配置项：
- `WALLET_A_ADDRESS`: 交易钱包地址
- `WALLET_A_PRIVATE_KEY`: 交易钱包私钥
- `WALLET_B_ADDRESS`: 利润接收钱包地址
- `DEEPSEEK_API_KEY`: DeepSeek API密钥

### 2. 初始化数据库

```bash
# 初始化数据库
./src/scripts/init_db.sh
```

## 启动系统

系统启动分为以下步骤：

### 1. 启动仪表盘

```bash
./src/scripts/start_system.sh
```

这个命令会：
1. 检查环境和配置
2. 启动Web仪表盘
3. 启动交易机器人
4. 自动连接所有组件

### 2. 验证启动

启动后，您可以：

1. 访问仪表盘：
   - 打开浏览器访问 http://localhost:8000
   - 查看系统状态和性能指标

2. 检查日志：
   ```bash
   # 查看交易机器人日志
   tail -f logs/bot.log

   # 查看仪表盘日志
   tail -f logs/dashboard.log
   ```

## 监控交易

### 1. 仪表盘功能

仪表盘提供以下信息：
- 系统状态（运行时间、交易次数、成功率）
- 实时价格图表
- 交易量分析
- 最近交易记录
- 性能指标

### 2. 性能指标

您可以在仪表盘上查看：
- 总交易次数
- 成功率
- 平均利润
- 最大回撤
- 风险评估

### 3. 交易记录

每笔交易都会记录：
- 交易时间
- 交易对
- 买入/卖出
- 价格和数量
- 交易状态
- 利润/亏损

## 停止系统

### 1. 正常停止

```bash
./src/scripts/stop_system.sh
```

这个命令会：
1. 安全停止交易机器人
2. 保存性能指标
3. 停止仪表盘
4. 压缩日志文件

### 2. 强制停止

如果需要强制停止：
```bash
./src/scripts/stop_system.sh -f
```

## 常见问题

### Q: 如何确认系统正在运行？
A: 访问 http://localhost:8000 查看仪表盘，或检查进程：
```bash
ps aux | grep trading_ai.py
ps aux | grep dashboard.py
```

### Q: 如何查看历史交易记录？
A: 在仪表盘的"最近交易"部分查看，或直接查询数据库：
```bash
sqlite3 data/tradingbot.db "SELECT * FROM trades ORDER BY timestamp DESC LIMIT 10;"
```

### Q: 如何备份数据？
A: 系统会自动备份日志和性能数据：
```bash
# 查看备份
ls -l logs/*.gz
ls -l data/backups/
```

### Q: 如何更新API密钥？
A: 编辑配置文件并重启系统：
```bash
vim config/.env  # 更新API密钥
./src/scripts/stop_system.sh
./src/scripts/start_system.sh
```

### Q: 如何切换到测试网？
A: 在配置文件中设置：
```bash
vim config/.env
# 设置 ENABLE_TESTNET=true
```

### Q: 如何查看详细日志？
A: 使用以下命令：
```bash
# 实时查看日志
tail -f logs/bot.log

# 查看错误日志
grep ERROR logs/bot.log

# 查看特定时间段的日志
sed -n '/2024-02-25 10:00/,/2024-02-25 11:00/p' logs/bot.log
```

## 安全提示

1. 定期备份数据
2. 保护好私钥和API密钥
3. 监控系统性能和风险指标
4. 定期检查日志文件
5. 使用强密码和2FA
6. 保持系统更新

## 支持

如果遇到问题：
1. 查看日志文件
2. 检查配置文件
3. 参考错误信息
4. 联系技术支持

## 下一步

- [完整API文档](api.md)
- [开发指南](development.md)
- [部署文档](deployment.md)
- [工作流程](workflow.md)
