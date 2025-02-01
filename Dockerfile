# 多阶段构建
FROM python:3.11-slim as base

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 安装Python依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# API服务构建阶段
FROM base as api
COPY . .
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]

# 前端构建阶段
FROM node:18 as frontend-builder
WORKDIR /app
COPY src/frontend/package*.json ./
RUN npm install
COPY src/frontend/ .
RUN npm run build

# 前端生产阶段
FROM nginx:alpine as frontend
COPY --from=frontend-builder /app/dist /usr/share/nginx/html
COPY src/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000 || exit 1

# Go执行器构建阶段
FROM golang:1.21 as executor-builder
WORKDIR /app
COPY src/go_executor/go.mod src/go_executor/go.sum ./
RUN go mod download
COPY src/go_executor/ .
RUN CGO_ENABLED=0 GOOS=linux go build -o executor

# Go执行器生产阶段
FROM alpine:latest as executor
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=executor-builder /app/executor .
EXPOSE 8001
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -q -O - http://localhost:8001/health || exit 1
CMD ["./executor"]
