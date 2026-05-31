"""
数据库连接配置模块
负责创建 SQLAlchemy 引擎、会话工厂，以及提供 FastAPI 依赖注入的数据库会话
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# ==================== 数据库连接配置 ====================
# MySQL 5.7 连接信息
DB_HOST = "localhost"
DB_PORT = 3306
DB_USER = "Yxy"
DB_PASSWORD = "Yxy10070525"
DB_NAME = "light_health"

# 构建 SQLAlchemy 数据库连接 URL（使用 pymysql 驱动）
DATABASE_URL = (
    f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    "?charset=utf8mb4"
)

# 创建数据库引擎
# pool_pre_ping=True：每次从连接池取连接时先检测连接是否有效，避免断连问题
# pool_recycle=3600：连接回收时间（秒），防止 MySQL 长时间空闲断开
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=False,  # 设为 True 可打印 SQL 语句，便于调试
)

# 创建会话工厂，用于生成数据库会话
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 声明式基类，所有 ORM 模型均继承此类
Base = declarative_base()


def get_db():
    """
    FastAPI 依赖注入函数：获取数据库会话
    请求结束后自动关闭会话，确保资源释放
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
