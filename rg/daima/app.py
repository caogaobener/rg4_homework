import streamlit as st
import sys
import os

# 确保能正确导入你的项目模块
sys.path.append(os.path.dirname(__file__))
from agent_core import run_agent
from memory import load_memory, get_preferences

# 🎨 页面基础配置
st.set_page_config(
    page_title="🌤️ 天气出行智能助手",
    page_icon="🌤️",
    layout="centered",
    initial_sidebar_state="expanded"
)

# 📌 标题区
st.title("🌤️ 天气出行智能助手")
st.caption("基于 AI 的智能天气查询与个性化出行规划系统")

# 📊 侧边栏：实时显示记忆状态
with st.sidebar:
    st.header("⚙️ 当前状态")
    memory = load_memory()
    prefs = memory.get("preferences", [])
    last_city = memory.get("last_city", "北京")
    
    st.info(f"📍 记住的城市：{last_city}")
    st.subheader("🎯 已保存的偏好")
    if prefs:
        for p in prefs:
            st.success(f"• {p}")
    else:
        st.warning("暂无偏好设置")
        
    st.divider()
    if st.button("🗑️ 清空记忆", type="secondary", use_container_width=True):
        # 调用后端清空逻辑
        from agent_core import agent
        agent.memory = {"preferences": [], "last_city": "北京", "history": [], "context": {}}
        from memory import save_memory
        save_memory(agent.memory)
        st.session_state.messages = []
        st.success("✅ 记忆已清空！")

# 💬 聊天历史初始化
if "messages" not in st.session_state:
    # 尝试从 memory.json 加载历史
    memory = load_memory()
    st.session_state.messages = memory.get("history", [])

# 🖼️ 渲染历史消息
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

# ⌨️ 输入框与交互逻辑
if prompt := st.chat_input("问我天气、穿衣建议，或设置偏好（如：我不喜欢下雨天）..."):
    # 1. 显示用户消息
    with st.chat_message("user"):
        st.markdown(prompt)
    st.session_state.messages.append({"role": "user", "content": prompt})
    
    # 2. 调用 AI 并显示回复
    with st.chat_message("assistant"):
        with st.spinner("🤖 正在查询天气 & 生成建议..."):
            try:
                response = run_agent(prompt)
                st.markdown(response)
                st.session_state.messages.append({"role": "assistant", "content": response})
            except Exception as e:
                st.error(f"❌ 系统开小差了：{str(e)[:50]}...")
                st.session_state.messages.append({"role": "assistant", "content": "抱歉，网络或接口暂时异常，请稍后再试~"})

# 📝 底部提示
st.divider()
st.markdown("""
<div style='text-align: center; color: #888; font-size: 12px;'>
💡 提示：支持多轮对话记忆 | 偏好自动持久化 | 查天气自动附带 AI 出行建议
</div>
""", unsafe_allow_html=True)