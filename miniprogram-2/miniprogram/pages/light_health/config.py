"""项目配置（可从环境变量覆盖）"""
import os

# 微信小程序（真机步数解密必填，在微信公众平台获取）
WECHAT_APPID = os.getenv("WECHAT_APPID", "wx4b887b8295ddfc9a")
WECHAT_SECRET = os.getenv("WECHAT_SECRET", "8f76ad0d5d38d0a847467b6469b2cb93")

# 开发模式：未配置 Secret 时步数同步使用模拟数据（仅便于联调）
WECHAT_DEV_MOCK = os.getenv("WECHAT_DEV_MOCK", "true").lower() in ("1", "true", "yes")

DEFAULT_USER_ID = "test_user_001"
