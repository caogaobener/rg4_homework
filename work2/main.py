#!/usr/bin/env python3
"""
main.py - 命令行聊天入口
成员A交付：直接运行 python main.py 即可开始对话

使用示例：
$ python main.py
🤖 你好！我是天气出行小助手，可以帮你查天气、给建议~
👉 试试问我："北京天气怎么样？"

> 上海明天会下雨吗
🤖 📅 上海明天：小雨，18~22°C
    ☔ 出行建议：带伞，安排室内活动...
"""


import sys
import signal
from work2.agent_core import run_agent
from work2.utils import pretty_print, log_info

def signal_handler(sig, frame):
    """优雅退出"""
    print("\n👋 再见！记得带伞哦~ ☔")
    sys.exit(0)

def main():
    # 注册退出信号
    signal.signal(signal.SIGINT, signal_handler)
    
    # 欢迎语
    print("\n" + "="*50)
    print("🌤️  天气出行小助手 - 命令行版")
    print("="*50)
    print("🤖 你好！我可以帮你：")
    print("   • 查天气：'北京天气'")
    print("   • 问预报：'明天上海会下雨吗'") 
    print("   • 要建议：'去广州穿什么'")
    print("   • 设偏好：'我不喜欢下雨天'")
    print("\n💡 输入 '帮助' 查看更多，输入 '退出' 结束对话")
    print("-"*50 + "\n")
    
    # 主循环
    while True:
        try:
            # 获取输入
            user_input = input("👉 ").strip()
            
            # 退出指令
            if user_input.lower() in ["退出", "exit", "quit", "q"]:
                print("👋 再见！记得带伞哦~ ☔")
                break
            
            if not user_input:
                continue
            
            # 处理并回复
            response = run_agent(user_input)
            print()
            pretty_print(response)
            print("-"*30 + "\n")
            
        except EOFError:
            # 处理Ctrl+D
            print("\n👋 再见！")
            break
        except KeyboardInterrupt:
            # 处理Ctrl+C
            print("\n👋 再见！记得带伞哦~ ☔")
            break
        except Exception as e:
            log_info(f"❌ 系统错误: {e}")
            print("⚠️ 出错了，请稍后再试~")

if __name__ == "__main__":
    main()