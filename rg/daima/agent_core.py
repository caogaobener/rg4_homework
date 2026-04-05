
"""
agent.py - 智能体核心逻辑
成员A负责:意图识别 + 工具调度 + 回复组织 + 异常兜底

对接约定：
- B模块 weather_api.py 提供: get_weather(city: str) -> dict
- C模块 memory.py 提供: load_memory(), save_memory(), update_preference()
- C模块 planner.py 提供: generate_plan(weather: dict, preferences: list) -> str
"""

import re
import json
from typing import Optional, Dict, List

from config import get_llm_config, DEFAULT_CITY, MEMORY_FILE
from utils import log_info, log_error, log_debug, safe_call, pretty_print

# ========== 导入B/C模块（假设已存在）==========
# 如果模块还没写好，先用mock函数占位，方便A独立开发测试
try:
    from weather_api import get_weather
except ImportError:
    log_info("⚠️ weather_api模块未找到，使用mock函数")
    def get_weather(city: str) -> dict:
        return {
            "success": True,
            "city": city,
            "text": "晴",
            "temp": 25,
            "humidity": 60,
            "wind": "东南风2级",
            "forecast": [{"date": "明天", "text": "多云", "temp_min": 20, "temp_max": 28}]
        }

try:
    from memory import load_memory, save_memory, update_preference, get_preferences
except ImportError:
    log_info("⚠️ memory模块未找到，使用mock函数")
    _mock_memory = {"preferences": [], "last_city": DEFAULT_CITY}
    def load_memory(): return _mock_memory
    def save_memory(m): pass
    def update_preference(pref: str): 
        if pref not in _mock_memory["preferences"]:
            _mock_memory["preferences"].append(pref)
    def get_preferences(): return _mock_memory["preferences"]

try:
    from planner import generate_plan
except ImportError:
    log_info("⚠️ planner模块未找到，使用mock函数")
    def generate_plan(weather: dict, preferences: list) -> str:
        return f"📋 出行建议：天气{weather['text']}，{weather['temp']}°C\n" + \
               ("☔ 带伞，" if "雨" in weather['text'] else "") + \
               ("🧥 穿外套" if weather['temp'] < 20 else "👕 穿短袖")

# ========== LLM客户端（多方案支持）==========
class LLMClient:
    """统一封装各种LLM调用"""
    
    def __init__(self):
        self.config = get_llm_config()
        self.client = None
        self._init_client()
    
    def _init_client(self):
        provider = self.config["provider"]
        
        if provider == "zhipuai":
            try:
                from zhipuai import ZhipuAI
                self.client = ZhipuAI(api_key=self.config["api_key"])
                log_info("✅ 已启用智谱AI")
            except ImportError:
                log_error("❌ 未安装zhipuai库，运行: pip install zhipuai")
                self.client = None
                
        elif provider == "openai":
            try:
                from openai import OpenAI
                self.client = OpenAI(api_key=self.config["api_key"])
                log_info("✅ 已启用OpenAI")
            except ImportError:
                log_error("❌ 未安装openai库，运行: pip install openai")
                self.client = None
                
        elif provider == "local":
            try:
                from openai import OpenAI
                self.client = OpenAI(
                    api_key="ollama",  # 任意值
                    base_url=self.config["base_url"]
                )
                log_info(f"✅ 已启用本地模型: {self.config['model']}")
            except ImportError:
                log_error("❌ 未安装openai库，运行: pip install openai")
                self.client = None
        else:
            log_info("⚠️ 无可用LLM，将使用规则引擎兜底")
            self.client = None
    
    def chat(self, messages: List[Dict], temperature: float = 0.7) -> Optional[str]:
        """
        发送对话请求
        :param messages: [{"role": "user/system", "content": "..."}]
        :return: AI回复文本,失败返回None
        """
        if not self.client:
            return None
        
        try:
            if self.config["provider"] == "zhipuai":
                response = self.client.chat.completions.create(
                    model=self.config["model"],
                    messages=messages,
                    temperature=temperature,
                    max_tokens=1024
                )
                return response.choices[0].message.content
            
            elif self.config["provider"] in ["openai", "local"]:
                response = self.client.chat.completions.create(
                    model=self.config["model"],
                    messages=messages,
                    temperature=temperature,
                    max_tokens=1024
                )
                return response.choices[0].message.content
                
        except Exception as e:
            log_error(f"LLM调用失败: {e}")
            return None
        
        return None

# ========== 意图识别引擎 ==========
class IntentRecognizer:
    """
    双模式意图识别：
    1. LLM模式：让大模型分析用户意图（更准确）
    2. 规则模式：关键词匹配（快速兜底）
    """
    
    # 关键词映射：关键词 -> 意图类型
    KEYWORD_INTENTS = {
        "天气": "query_weather",
        "气温": "query_weather",
        "下雨": "query_weather",
        "晴天": "query_weather",
        "预报": "query_forecast",
        "明天": "query_forecast",
        "后天": "query_forecast",
        "穿什么": "ask_advice",
        "穿衣": "ask_advice",
        "活动": "ask_advice",
        "去哪玩": "ask_advice",
        "出行": "ask_advice",
        "计划": "ask_advice",
        "喜欢": "set_preference",
        "不喜欢": "set_preference",
        "讨厌": "set_preference",
        "怕冷": "set_preference",
        "怕热": "set_preference",
    }
    
    def __init__(self, llm_client: LLMClient):
        self.llm = llm_client
    
    def recognize(self, user_input: str, context: Dict) -> Dict:
        """
        识别用户意图
        :return: {
            "intent": "query_weather|query_forecast|ask_advice|set_preference|chat|unknown",
            "entities": {"city": "北京", "date": "明天"},
            "preference": "avoid_rain",  # 如果是设置偏好
            "confidence": 0.9  # 置信度（规则模式固定0.7）
        }
        """
        # 优先尝试LLM识别（更准）
        if self.llm.client:
            result = self._recognize_with_llm(user_input, context)
            if result and result["confidence"] > 0.6:
                return result
        
        # 降级到规则匹配
        return self._recognize_with_rules(user_input)
    
    def _recognize_with_llm(self, user_input: str, context: Dict) -> Optional[Dict]:
        """用LLM分析意图"""
        prompt = f"""你是一个意图识别助手。请分析用户输入，返回JSON格式结果。

可用意图类型：
- query_weather: 查询当前天气（如"北京天气"）
- query_forecast: 查询天气预报（如"明天上海会下雨吗"）
- ask_advice: 询问出行/穿衣建议（如"去广州穿什么"）
- set_preference: 设置偏好（如"我不喜欢下雨天"）
- chat: 普通聊天（如"你好"）
- unknown: 无法识别

用户输入：{user_input}
已知上下文：{json.dumps(context, ensure_ascii=False)}

请严格返回JSON，格式：
{{
    "intent": "意图类型",
    "entities": {{"city": "城市名", "date": "时间"}},
    "preference": "偏好关键词（仅set_preference时需要）",
    "confidence": 0.9
}}
只返回JSON，不要其他内容。"""
        
        messages = [{"role": "user", "content": prompt}]
        response = self.llm.chat(messages, temperature=0.1)  # 低温度保证格式稳定
        
        if not response:
            return None
        
        try:
            # 提取JSON（LLM可能加```json包裹）
            json_str = re.search(r'\{.*\}', response, re.DOTALL)
            if json_str:
                result = json.loads(json_str.group())
                result["confidence"] = float(result.get("confidence", 0.7))
                return result
        except:
            log_debug(f"LLM意图识别解析失败: {response[:100]}")
        
        return None
    
    def _recognize_with_rules(self, user_input: str) -> Dict:
        """规则关键词匹配（兜底方案）"""
        user_input_lower = user_input.lower()
        
        # 1. 提取城市（简单版：匹配常见城市名）
        cities = ["北京", "上海", "广州", "深圳", "杭州", "成都", "武汉", "西安", 
                 "南京", "重庆", "天津", "苏州", "郑州", "长沙", "青岛", "大连"]
        city = None
        for c in cities:
            if c in user_input:
                city = c
                break
        
        # 2. 提取时间
        date = None
        if "明天" in user_input:
            date = "明天"
        elif "后天" in user_input:
            date = "后天"
        elif "今天" in user_input or "现在" in user_input:
            date = "今天"
        
        # 3. 匹配意图
        intent = "unknown"
        preference = None
        
        for keyword, intent_type in self.KEYWORD_INTENTS.items():
            if keyword in user_input_lower:
                intent = intent_type
                if intent_type == "set_preference":
                    # 提取偏好关键词
                    if "不喜欢雨" in user_input or "讨厌下雨" in user_input:
                        preference = "avoid_rain"
                    elif "怕冷" in user_input:
                        preference = "avoid_cold"
                    elif "怕热" in user_input:
                        preference = "avoid_heat"
                    elif "喜欢户外" in user_input:
                        preference = "prefer_outdoor"
                break
        
        # 4. 默认意图：如果包含城市+天气词，默认查天气
        if intent == "unknown" and city and any(w in user_input_lower for w in ["天气", "气温", "下雨"]):
            intent = "query_weather"
        
        return {
            "intent": intent,
            "entities": {"city": city, "date": date},
            "preference": preference,
            "confidence": 0.7
        }

# ========== 智能体主类 ==========
class WeatherAgent:
    """
    天气出行智能体 - 成员A的核心交付物
    职责：对话管理 + 意图识别 + 工具调度 + 回复生成
    """
    
    def __init__(self):
        self.llm = LLMClient()
        self.recognizer = IntentRecognizer(self.llm)
        self.memory = load_memory()
        log_info("🤖 智能体初始化完成")
    
    def process(self, user_input: str) -> str:
        """
        处理用户输入，返回回复
        主入口函数，被main.py调用
        """
        log_info(f"👤 用户: {user_input}")
        
        # 1. 处理系统指令
        if user_input.strip() in ["清空记忆", "重置", "/clear"]:
            self.memory = {"preferences": [], "last_city": DEFAULT_CITY, "history": [], "context": {}}
            save_memory(self.memory)
            return "✅ 记忆已清空，所有偏好和历史记录已重置~"
        
        if user_input.strip() in ["帮助", "help", "/help"]:
            return self._get_help_text()
        
        # 2. 识别意图
        intent_result = self.recognizer.recognize(user_input, {
            "last_city": self.memory.get("last_city", DEFAULT_CITY),
            "preferences": self.memory.get("preferences", [])
        })
        intent = intent_result.get("intent","unknown")
        entities = intent_result.get("entities",{})
        preference = intent_result.get("preference")

        # 🛠️ 清洗 preference：纠正 LLM 的错误输出
        if preference and isinstance(preference, str) and preference not in ["avoid_rain", "avoid_cold", "avoid_heat", "prefer_outdoor", "prefer_indoor"]:
            if "雨" in preference or "下雨" in preference:
                preference = "avoid_rain"
            elif "冷" in preference:
                preference = "avoid_cold"
            elif "热" in preference:
                preference = "avoid_heat"
            elif "户外" in preference:
                preference = "prefer_outdoor"
        
        log_debug(f"🎯 意图: {intent}, 实体: {entities}, 偏好: {preference}")
        
        
        # 3. 处理偏好设置
        if intent == "set_preference" and preference:
            update_preference(preference)
            self.memory = load_memory()  # 重新加载
    
       # 偏好文本映射
            pref_map = {
            "avoid_rain": "不喜欢下雨天",
            "avoid_cold": "怕冷",
            "avoid_heat": "怕热",
            "prefer_outdoor": "喜欢户外活动",
            "prefer_indoor": "喜欢室内活动"
        }
    
            pref_text = pref_map.get(preference, preference)
            return f"✅ 已记住：您{pref_text}。下次出行建议会考虑这个偏好！"
        
        # 4. 确定城市（优先用户指定，其次记忆，最后默认）
        city = entities.get("city") or self.memory.get("last_city") or DEFAULT_CITY
        if entities.get("city"):  # 用户指定了新城市，更新记忆
            self.memory["last_city"] = city
            save_memory(self.memory)
        
        # 5. 根据意图执行动作
        response = ""
        
        if intent in ["query_weather", "query_forecast"]:
            # 查天气
            weather = safe_call(get_weather, city, default={"success": False})
            
            if not weather or not weather.get("success"):
                response = f"❌ 抱歉，没查到{city}的天气，请稍后再试~"
            else:
                # 格式化天气信息
                response = self._format_weather_response(weather, entities.get("date"))
                
                # 如果用户同时问了建议，自动调用规划器
                
                plan = safe_call(generate_plan, weather, get_preferences(), default="")
                if plan:
                        response += "\n\n" + plan
        
        elif intent == "ask_advice":
            # 直接要建议：先查天气再生成计划
            weather = safe_call(get_weather, city, default={"success": False})
            if weather and weather.get("success"):
                plan = safe_call(generate_plan, weather, get_preferences(), default="")
                response = plan if plan else "🤔 暂时没想到好建议，换个问题试试？"
            else:
                response = f"⚠️ 先让我查查{city}的天气，再给你建议~"
                # 递归调用查天气
                return self.process(f"{city}天气怎么样")
        
        elif intent == "chat":
            # 普通聊天：用LLM回复（或规则兜底）
            response = self._chat_response(user_input)
        
        else:
            # 未知意图：友好引导
            response = self._fallback_response(user_input, city)
        
        # 6. 添加记忆摘要（增强多轮感）
        prefs = get_preferences()
        if prefs:
            response += f"\n\n📌 小提示：已记住您的偏好：{', '.join(prefs)}"
        # 保存对话历史到 memory
        if "history" not in self.memory:
             self.memory["history"] = []
        self.memory["history"].append({"user": user_input, "bot": response})
        # 只保留最近 20 条
        if len(self.memory["history"]) > 20:
            self.memory["history"] = self.memory["history"][-20:]
        save_memory(self.memory)
        log_info(f"🤖 回复: {response[:100]}...")
        return response
    
    def _format_weather_response(self, weather: dict, date: str = None) -> str:
        """格式化天气回复"""
        city = weather.get("city", "未知城市")
        
        if date and date != "今天":
            # 天气预报
            forecast = weather.get("forecast", [{}])[0]
            text = forecast.get("text", "未知")
            temp_min = forecast.get("temp_min", "?")
            temp_max = forecast.get("temp_max", "?")
            return f"📅 {city}{date}：{text}，{temp_min}~{temp_max}°C"
        else:
            # 当前天气
            text = weather.get("text", "未知")
            temp = weather.get("temp", "?")
            humidity = weather.get("humidity", "?")
            wind = weather.get("wind", "")
            return f"📍 {city}当前：{text}，{temp}°C，湿度{humidity}%，{wind}"
    
    def _chat_response(self, user_input: str) -> str:
        """普通聊天回复"""
        if not self.llm.client:
            # 规则兜底
            if any(w in user_input for w in ["你好", "嗨", "hello"]):
                return "👋 你好呀！我是天气小助手，可以帮你查天气、给出行建议~ 试试问我'北京天气怎么样？'"
            elif any(w in user_input for w in ["谢谢", "感谢"]):
                return "😊 不客气！有其他问题随时问我~"
            else:
                return "🤔 这个问题我还在学习中... 你可以问我天气或出行相关的问题哦！"
        
        # 用LLM回复
        messages = [
            {"role": "system", "content": "你是一个友好、简洁的天气助手，用口语化中文回复，适当加emoji。"},
            {"role": "user", "content": user_input}
        ]
        response = self.llm.chat(messages)
        return response or "🤔 让我再想想..."
    
    def _fallback_response(self, user_input: str, city: str) -> str:
        """未知意图的兜底回复"""
        # 尝试提取城市，主动提供价值
        if city != DEFAULT_CITY:
            return f"🤔 没完全听懂，不过我可以先告诉你{city}的天气：\n" + \
                   self._format_weather_response(safe_call(get_weather, city, default={}))
        else:
            return "🤔 没太明白你的意思~ 你可以这样问我：\n" + \
                   "• '北京天气怎么样？'\n" + \
                   "• '明天上海会下雨吗？'\n" + \
                   "• '去广州应该穿什么？'\n" + \
                   "• '我不喜欢下雨天'"
    
    def _get_help_text(self) -> str:
        """返回帮助信息"""
        return """📚 使用指南：

🔍 查询天气
  • "北京天气" / "上海气温" / "深圳现在多少度"

📅 查询预报  
  • "明天北京会下雨吗" / "后天上海天气"

👔 出行建议
  • "去杭州穿什么" / "成都周末适合户外活动吗"

❤️ 设置偏好
  • "我不喜欢下雨天" / "我怕冷" / "我喜欢户外"

⚙️ 系统指令
  • "帮助" / "清空记忆"

💡 小提示：多轮对话中我会记住你的城市和偏好哦~"""

# 全局实例
agent = WeatherAgent()

def run_agent(user_input: str) -> str:
    """供外部调用的统一接口"""
    return agent.process(user_input)
