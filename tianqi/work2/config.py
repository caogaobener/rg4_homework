"""
config.py - 全局配置管理
成员A负责维护，其他模块通过import config使用
"""
import os
from dotenv import load_dotenv

# 加载.env环境变量
load_dotenv()

# ========== LLM配置 ==========
# 支持多种模型，按需启用（优先级：智谱 > OpenAI > 本地 > 降级规则引擎）

# 【方案1】智谱AI（国产推荐，有免费额度）
ZHIPUAI_API_KEY = os.getenv("ZHIPUAI_API_KEY", "")
ZHIPUAI_MODEL = os.getenv("ZHIPUAI_MODEL", "glm-4-flash")  # 轻量版，响应快

# 【方案2】OpenAI（需科学上网）
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")

# 【方案3】本地模型（通过Ollama，完全免费）
LOCAL_MODEL_ENABLED = os.getenv("LOCAL_MODEL", "false").lower() == "true"
LOCAL_MODEL_NAME = os.getenv("LOCAL_MODEL_NAME", "qwen2.5:7b")
LOCAL_MODEL_BASE_URL = os.getenv("LOCAL_MODEL_BASE_URL", "http://localhost:11434/v1")

# 【降级方案】无LLM时使用规则引擎
FALLBACK_TO_RULES = True  # 始终为True，确保有兜底

# ========== 系统配置 ==========
# 默认城市（用户未指定时使用）
DEFAULT_CITY = "北京"

# 记忆文件路径（与C模块约定）
MEMORY_FILE = "memory.json"

# 日志级别
LOG_LEVEL = "INFO"  # DEBUG / INFO / WARNING / ERROR

# ========== 工具函数 ==========
def get_llm_config():
    """返回当前可用的LLM配置"""
    if ZHIPUAI_API_KEY:
        return {
            "provider": "zhipuai",
            "api_key": ZHIPUAI_API_KEY,
            "model": ZHIPUAI_MODEL,
            "base_url": "https://open.bigmodel.cn/api/paas/v4/"
        }
    elif OPENAI_API_KEY:
        return {
            "provider": "openai",
            "api_key": OPENAI_API_KEY,
            "model": OPENAI_MODEL
        }
    elif LOCAL_MODEL_ENABLED:
        return {
            "provider": "local",
            "model": LOCAL_MODEL_NAME,
            "base_url": LOCAL_MODEL_BASE_URL
        }
    else:
        return {"provider": "fallback"}  # 降级到规则引擎