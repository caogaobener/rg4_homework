# test_ai.py - 使用OpenAI格式调用（更稳定）
from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("ZHIPUAI_API_KEY")

if not API_KEY:
    print("❌ 错误：未找到 API Key，请检查 .env 文件")
    exit()

print(f"🔑 API Key: {API_KEY[:20]}...")
print("🔄 正在连接智谱AI...")

# 使用智谱的 OpenAI 兼容接口
client = OpenAI(
    api_key=API_KEY,
    base_url="https://open.bigmodel.cn/api/paas/v4/",
    timeout=30  # 设置超时时间
)

try:
    response = client.chat.completions.create(
        model="glm-4-flash",
        messages=[
            {"role": "user", "content": "你好，请用一句话介绍你自己"}
        ],
        max_tokens=100
    )
    
    print("✅ API调用成功！")
    print("回复：", response.choices[0].message.content)
    
except Exception as e:
    print(f"❌ 调用失败：{type(e).__name__}")
    print(f"错误详情：{e}")
    print("\n💡 建议：")
    print("1. 检查网络连接")
    print("2. 确认 API Key 是否正确")
    print("3. 检查智谱AI服务是否正常")