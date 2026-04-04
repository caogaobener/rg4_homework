"""
memory.py - 成员C负责：出行规划，支持AI+规则双模式，根据天气以及喜好等多方因素共同制定
"""

from config import get_llm_config

def generate_plan(weather: dict, preferences: list, use_ai: bool = True) -> str:
    """统一接口"""
    if use_ai:
        return _generate_with_ai(weather, preferences)
    else:
        return _generate_with_rules(weather, preferences)

def _generate_with_ai(weather: dict, preferences: list) -> str:
    """AI模式生成建议"""
    if not weather.get("success"):
        return "⚠️ 天气数据获取失败"
    
    # 构造Prompt
    city = weather.get("city", "该城市")
    text = weather.get("text", "未知")
    temp = weather.get("temp", 25)
    humidity = weather.get("humidity", 50)
    pref_text = "、".join(preferences) if preferences else "无特殊偏好"
    
    prompt = f"""你是一个旅行规划师。根据以下信息给出建议：

【天气】{city}，{text}，{temp}°C，湿度{humidity}%
【偏好】{pref_text}

请按格式回复：
👔 穿衣建议：
🎯 推荐活动：（3个）
⚠️ 特别提醒：
"""
    
    try:
        config = get_llm_config()
        if not config.get("api_key"):
            return _generate_with_rules(weather, preferences)
        
        from zhipuai import ZhipuAI
        client = ZhipuAI(api_key=config["api_key"])
        
        response = client.chat.completions.create(
            model=config["model"],
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.7
        )
        
        return response.choices[0].message.content
        
    except Exception as e:
        print(f"⚠️ AI调用失败：{e}，使用规则引擎")
        return _generate_with_rules(weather, preferences)

def _generate_with_rules(weather: dict, preferences: list) -> str:
    """规则模式（兜底）"""
    # 这里放你原来的规则代码...
    temp = weather.get("temp", 25)
    text = weather.get("text", "未知")
    
    if temp < 10:
        clothing = "🧥 厚羽绒服"
    elif temp < 18:
        clothing = "🧥 夹克"
    else:
        clothing = "👕 短袖"
    
    activities = ["🏛️ 博物馆", "🎬 电影院", "☕ 咖啡馆"]
    
    return f"📋 出行计划：\n👔 {clothing}\n🎯 {', '.join(activities)}"