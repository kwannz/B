# 构建阶段
FROM python:3.11-slim as builder

WORKDIR /app

# 安装构建依赖
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 复制项目文件
COPY . .

# 安装Python依赖
RUN pip install --no-cache-dir -e .

# 运行阶段
FROM python:3.11-slim

WORKDIR /app

# 安装运行时依赖
RUN apt-get update && apt-get install -y \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 从构建阶段复制安装好的包
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /app /app

# 设置环境变量
ENV PYTHONPATH=/app:$PYTHONPATH \
    DATABASE_URL="postgresql://tradingbot:tradingbot@postgres:5432/tradingbot" \
    REDIS_URL="redis://redis:6379/0"

# 暴露端口
EXPOSE 8000 8001

# 启动命令（将在docker-compose中覆盖）
CMD ["uvicorn", "src.api_gateway.app.main:app", "--host", "0.0.0.0", "--port", "8000"] 