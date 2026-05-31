"""
微信小程序登录：code 换取 session_key（用于解密运动步数）
"""

import os
from datetime import datetime
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from config import WECHAT_APPID, WECHAT_SECRET, WECHAT_DEV_MOCK, DEFAULT_USER_ID
from database import get_db
from fastapi import Depends
from api.deps import get_or_create_user

router = APIRouter(prefix="/api/wechat", tags=["微信"])

MOCK_SESSION_KEY = "ZGV2X21vY2tfc2Vzc2lvbl9rZXkxMjM0NTY="


class WxLoginRequest(BaseModel):
    code: str = Field(..., min_length=1, description="wx.login 返回的 code")
    user_id: str = Field(default=DEFAULT_USER_ID, max_length=32)


class WxLoginData(BaseModel):
    user_id: str
    openid: str
    session_key: str
    mock: bool = False


class WxLoginResponse(BaseModel):
    code: int = 200
    message: str = "success"
    data: Optional[WxLoginData] = None


@router.post("/session", response_model=WxLoginResponse)
def wx_login(body: WxLoginRequest, db: Session = Depends(get_db)):
    """
    使用 wx.login 的 code 换取 session_key。
    小程序将 session_key 存到 globalData，同步步数时传给 /werun/sync。
    """
    user_id = body.user_id.strip()

    if not WECHAT_SECRET:
        if WECHAT_DEV_MOCK:
            get_or_create_user(db, user_id, f"mock_{user_id}")
            return WxLoginResponse(
                code=200,
                message="开发模式（未配置 WECHAT_SECRET，步数同步将使用模拟数据）",
                data=WxLoginData(
                    user_id=user_id,
                    openid=f"mock_{user_id}",
                    session_key=MOCK_SESSION_KEY,
                    mock=True,
                ),
            )
        raise HTTPException(
            status_code=503,
            detail="服务端未配置 WECHAT_SECRET，请在环境变量中设置微信小程序 AppSecret",
        )

    url = "https://api.weixin.qq.com/sns/jscode2session"
    params = {
        "appid": WECHAT_APPID,
        "secret": WECHAT_SECRET,
        "js_code": body.code,
        "grant_type": "authorization_code",
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(url, params=params)
            data = resp.json()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"微信登录接口请求失败: {exc}") from exc

    if data.get("errcode"):
        if WECHAT_DEV_MOCK:
            get_or_create_user(db, user_id, f"mock_{user_id}")
            return WxLoginResponse(
                code=200,
                message="开发模式（微信登录失败，使用模拟 session 同步步数）",
                data=WxLoginData(
                    user_id=user_id,
                    openid=f"mock_{user_id}",
                    session_key=MOCK_SESSION_KEY,
                    mock=True,
                ),
            )
        raise HTTPException(
            status_code=400,
            detail=f"微信登录失败: {data.get('errmsg', data.get('errcode'))}",
        )

    session_key = data.get("session_key")
    openid = data.get("openid")
    if not session_key or not openid:
        raise HTTPException(status_code=502, detail="微信未返回 session_key")

    get_or_create_user(db, user_id, openid)

    return WxLoginResponse(
        code=200,
        message="success",
        data=WxLoginData(
            user_id=user_id,
            openid=openid,
            session_key=session_key,
            mock=False,
        ),
    )
