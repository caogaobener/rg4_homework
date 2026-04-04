

import logging
from datetime import datetime

# 配置日志
logging.basicConfig(
    level=getattr(logging, "INFO"),
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger(__name__)

def log_info(msg: str):
    logger.info(msg)

def log_error(msg: str):
    logger.error(msg)

def log_debug(msg: str):
    logger.debug(msg)

def format_time():
    """返回当前时间字符串"""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def safe_call(func, *args, default=None, **kwargs):
    """
    安全调用函数，捕获异常返回默认值
    用于调用B/C模块时的容错
    """
    try:
        return func(*args, **kwargs)
    except Exception as e:
        log_error(f"调用 {func.__name__} 失败: {e}")
        return default

def pretty_print(text: str):
    """
    美化输出：自动换行+分段
    让命令行回复更易读
    """
    # 简单实现：按句号/换行分段
    paragraphs = []
    current = ""
    
    for char in text:
        current += char
        if char in "。！？\n" and len(current) > 20:
            paragraphs.append(current.strip())
            current = ""
    
    if current.strip():
        paragraphs.append(current.strip())
    
    for p in paragraphs:
        print(p)
        print()  # 空行分隔
