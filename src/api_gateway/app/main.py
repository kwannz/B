from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import agent_routes

app = FastAPI(title="Trading Bot API Gateway")

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 在生产环境中应该设置具体的域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(agent_routes.router, prefix="/api/v1", tags=["agents"])

@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {"status": "healthy"}

@app.on_event("startup")
async def startup_event():
    """应用启动时的初始化操作"""
    # TODO: 初始化数据库连接
    # TODO: 加载配置
    pass

@app.on_event("shutdown")
async def shutdown_event():
    """应用关闭时的清理操作"""
    # TODO: 关闭数据库连接
    # TODO: 停止所有代理
    pass
