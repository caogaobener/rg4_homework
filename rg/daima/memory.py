"""
memory.py - 成员C负责：用户偏好记忆 + 城市记忆 + 历史上下文管理
"""
import os
import json
from config import MEMORY_FILE, DEFAULT_CITY

def load_memory() -> dict:
    """加载本地记忆文件"""
    if os.path.exists(MEMORY_FILE):
        try:
            with open(MEMORY_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    # 默认结构
    return {
        "last_city": DEFAULT_CITY,
        "preferences": [],
        "history": [],  # 记录最近5轮对话
        "context": {}
    }

def save_memory(memory: dict):
    """持久化保存到JSON"""
    with open(MEMORY_FILE, 'w', encoding='utf-8') as f:
        json.dump(memory, f, ensure_ascii=False, indent=2)

def update_preference(pref_key: str) -> bool:
    """添加用户偏好"""
    mem = load_memory()
    if pref_key not in mem["preferences"]:
        mem["preferences"].append(pref_key)
        save_memory(mem)
        return True  
    return False     

def get_preferences() -> list:
    """获取当前所有偏好"""
    return load_memory()["preferences"]

def update_city(city: str):
    """更新最近查询的城市"""
    mem = load_memory()
    mem["last_city"] = city
    save_memory(mem)

def add_to_history(user_input: str, bot_reply: str):
    """记录对话历史（保留最近5轮，用于多轮上下文）"""
    mem = load_memory()
    mem["history"].append({"user": user_input, "bot": bot_reply})
    if len(mem["history"]) > 5:
        mem["history"] = mem["history"][-5:]
    save_memory(mem)

def get_context_summary() -> str:
    """生成记忆摘要（给LLM或规则引擎用的上下文提示）"""
    mem = load_memory()
    parts = []
    if mem["last_city"] != DEFAULT_CITY:
        parts.append(f"用户上次查了{mem['last_city']}")
    if mem["preferences"]:
        parts.append(f"用户偏好：{', '.join(mem['preferences'])}")
    if mem["history"]:
        last = mem["history"][-1]
        parts.append(f"上一轮：用户问'{last['user']}'，我回了'{last['bot'][:20]}...'")
    return "；".join(parts) if parts else "新用户首次访问"