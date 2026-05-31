"""API 公共依赖"""
from datetime import datetime

from sqlalchemy.orm import Session

from models import User


def get_or_create_user(db: Session, user_id: str, wechat_id: str | None = None) -> User:
    """获取用户，不存在则自动创建（避免真机保存记录 404）"""
    user = db.query(User).filter(User.user_id == user_id).first()
    if user:
        if wechat_id and user.wechat_id != wechat_id:
            user.wechat_id = wechat_id
            db.commit()
            db.refresh(user)
        return user

    user = User(
        user_id=user_id,
        wechat_id=wechat_id or f"openid_{user_id}",
        nickname="轻养派用户",
        create_time=datetime.now(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
