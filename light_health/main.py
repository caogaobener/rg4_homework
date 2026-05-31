"""
轻养派小程序 FastAPI 后端主程序
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from api.exercise import router as exercise_router
from api.agent import router as agent_router
from api.wechat import router as wechat_router


def init_db():
    import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    print("[数据库] 所有表初始化完成")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


# 第1步：先定义 app
app = FastAPI(
    title="轻养派 API",
    description="轻养派小程序后端服务",
    version="1.0.0",
    lifespan=lifespan,
)

# 第2步：配置中间件和异常处理
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": exc.status_code, "message": detail, "data": None},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"code": 500, "message": str(exc), "data": None})

# 第3步：最后再注册路由（必须在 app 定义之后！）
app.include_router(exercise_router)
app.include_router(agent_router)
app.include_router(wechat_router)

# 第4步：其他路由
@app.get("/", tags=["系统"])
def root():
    return {"code": 200, "message": "轻养派 API 服务运行中", "data": {"service": "light_health", "version": "1.0.0"}}

@app.get("/health", tags=["系统"])
def health_check():
    return {"status": "ok"}