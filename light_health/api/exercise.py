"""
运动相关 API 接口
包含微信步数同步、步数趋势查询、运动记录增查等功能
"""

import base64
import json
import uuid
from datetime import datetime, date, timedelta
from typing import Optional

from Crypto.Cipher import AES
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from config import WECHAT_DEV_MOCK
from database import get_db
from api.deps import get_or_create_user
from models import User, ExerciseRecord, WerunData
from api.wechat import MOCK_SESSION_KEY
from schemas import (
    BaseResponse,
    WerunSyncRequest,
    WerunSyncResponse,
    WerunTrendItem,
    ExerciseRecordCreate,
    ExerciseRecordResponse,
    ClearExerciseRecordsRequest,
)

# 创建运动模块路由，统一前缀 /api/exercise
router = APIRouter(prefix="/api/exercise", tags=["运动管理"])


# ==================== 工具函数 ====================


def _generate_id() -> str:
    """生成 32 位唯一 ID（去除 UUID 中的连字符）"""
    return uuid.uuid4().hex


def _decrypt_werun_data(encrypted_data: str, iv: str, session_key: str) -> dict:
    """
    解密微信运动步数加密数据
    使用 AES-128-CBC 算法，与微信小程序 wx.getWeRunData 返回格式一致

    :param encrypted_data: Base64 编码的加密数据
    :param iv: Base64 编码的初始向量
    :param session_key: Base64 编码的会话密钥
    :return: 解密后的 JSON 字典
    :raises ValueError: 解密失败时抛出
    """
    try:
        # Base64 解码
        session_key_bytes = base64.b64decode(session_key)
        encrypted_bytes = base64.b64decode(encrypted_data)
        iv_bytes = base64.b64decode(iv)

        # AES-128-CBC 解密
        cipher = AES.new(session_key_bytes, AES.MODE_CBC, iv_bytes)
        decrypted = cipher.decrypt(encrypted_bytes)

        # 去除 PKCS7 填充
        pad_len = decrypted[-1]
        if pad_len < 1 or pad_len > 32:
            raise ValueError("无效的 PKCS7 填充")
        decrypted = decrypted[:-pad_len]

        # 解析 JSON
        return json.loads(decrypted.decode("utf-8"))
    except Exception as exc:
        raise ValueError(f"微信步数数据解密失败: {exc}") from exc


def _parse_step_date(item: dict) -> Optional[date]:
    """从 stepInfoList 单条记录解析统计日期"""
    dec_str = item.get("dec", "")
    ts = item.get("timestamp")

    if dec_str:
        for fmt in ("%Y.%m.%d", "%Y-%m-%d"):
            try:
                return datetime.strptime(dec_str, fmt).date()
            except ValueError:
                continue

    if ts:
        try:
            return datetime.fromtimestamp(int(ts)).date()
        except (ValueError, OSError, OverflowError):
            pass

    return None


def _parse_step_list(decrypted_data: dict) -> list[tuple[int, date]]:
    """
    解析微信运动解密数据中的 stepInfoList（含近 30 天每日步数）

    :return: [(步数, 统计日期), ...] 按日期升序
    """
    step_info_list = decrypted_data.get("stepInfoList", [])
    if not step_info_list:
        raise ValueError("解密数据中未找到步数信息")

    day_map: dict[date, int] = {}
    for item in step_info_list:
        stat_date = _parse_step_date(item)
        if not stat_date:
            continue
        day_map[stat_date] = int(item.get("step", 0))

    if not day_map:
        raise ValueError("未能从步数数据中解析有效日期")

    return sorted(((step, d) for d, step in day_map.items()), key=lambda x: x[1])


def _generate_dev_mock_steps(base_count: int, days: int = 7) -> list[tuple[int, date]]:
    """开发模式：生成近 N 天模拟步数（今日为 base_count）"""
    today = date.today()
    offsets = [0.82, 0.91, 0.76, 1.05, 0.88, 0.95]
    result: list[tuple[int, date]] = []

    for day_offset in range(days - 1, -1, -1):
        stat_date = today - timedelta(days=day_offset)
        if day_offset == 0:
            steps = base_count
        else:
            ratio = offsets[(days - 1 - day_offset) % len(offsets)]
            steps = int(base_count * ratio)
        result.append((max(steps, 0), stat_date))

    return result


def _upsert_step_records(
    db: Session,
    user_id: str,
    step_entries: list[tuple[int, date]],
) -> tuple[int, date]:
    """批量写入/更新步数记录，返回 (今日步数, 今日日期)"""
    today = date.today()

    for step_count, stat_date in step_entries:
        existing = (
            db.query(WerunData)
            .filter(
                WerunData.user_id == user_id,
                WerunData.stat_date == stat_date,
            )
            .first()
        )

        if existing:
            existing.step_count = step_count
            existing.update_time = datetime.now()
        else:
            db.add(
                WerunData(
                    data_id=_generate_id(),
                    user_id=user_id,
                    step_count=step_count,
                    stat_date=stat_date,
                    create_time=datetime.now(),
                    update_time=datetime.now(),
                )
            )

    db.commit()

    step_map = dict(step_entries)
    if today in step_map:
        return step_map[today], today
    if step_entries:
        return step_entries[-1][0], step_entries[-1][1]
    return 0, today


def _get_user_or_404(db: Session, user_id: str) -> User:
    """根据 user_id 查询用户，不存在则自动创建"""
    return get_or_create_user(db, user_id)


# ==================== API 接口 ====================


@router.post("/werun/sync", summary="同步微信运动步数")
def sync_werun_data(
    request: WerunSyncRequest,
    db: Session = Depends(get_db),
):
    """
    同步微信运动步数

    接收小程序端 wx.getWeRunData 获取的加密数据，
    使用 session_key 进行 AES-128-CBC 解密，并将步数写入数据库。

    - **encryptedData**: 微信加密数据
    - **iv**: 加密初始向量
    - **session_key**: 微信会话密钥
    - **user_id**: 用户 ID
    """
    get_or_create_user(db, request.user_id)

    use_dev_mock = (
        WECHAT_DEV_MOCK
        and request.session_key == MOCK_SESSION_KEY
        and request.dev_step_count is not None
    )

    step_entries: list[tuple[int, date]] = []

    if use_dev_mock:
        step_entries = _generate_dev_mock_steps(int(request.dev_step_count), days=7)
    else:
        try:
            decrypted = _decrypt_werun_data(
                request.encryptedData,
                request.iv,
                request.session_key,
            )
            step_entries = _parse_step_list(decrypted)
        except ValueError as exc:
            if WECHAT_DEV_MOCK and request.dev_step_count is not None:
                step_entries = _generate_dev_mock_steps(int(request.dev_step_count), days=7)
            else:
                raise HTTPException(status_code=400, detail=str(exc)) from exc

    latest_step, stat_date = _upsert_step_records(db, request.user_id, step_entries)

    response_data = WerunSyncResponse(
        user_id=request.user_id,
        step_count=latest_step,
        stat_date=stat_date,
        synced=True,
        synced_days=len(step_entries),
    )

    return BaseResponse(
        code=200,
        message=f"微信步数同步成功，已更新 {len(step_entries)} 天",
        data=response_data.model_dump(),
    )


@router.get("/trend", summary="获取近 N 天步数趋势")
def get_step_trend(
    user_id: str = Query(..., description="用户ID"),
    days: int = Query(default=7, ge=1, le=90, description="查询天数，默认7天"),
    db: Session = Depends(get_db),
):
    """
    获取用户近 N 天的微信步数趋势

    返回指定天数内每日步数，若某天无记录则步数为 0。
    """
    # 校验用户是否存在
    _get_user_or_404(db, user_id)

    # 计算日期范围（含今天）
    end_date = date.today()
    start_date = end_date - timedelta(days=days - 1)

    # 查询日期范围内的步数记录
    records = (
        db.query(WerunData)
        .filter(
            WerunData.user_id == user_id,
            WerunData.stat_date >= start_date,
            WerunData.stat_date <= end_date,
        )
        .order_by(WerunData.stat_date.asc())
        .all()
    )

    # 构建日期 -> 步数 映射
    step_map = {r.stat_date: r.step_count for r in records}

    # 填充完整日期序列（无记录的天数步数为 0）
    trend = []
    current = start_date
    while current <= end_date:
        trend.append(
            WerunTrendItem(
                stat_date=current,
                step_count=step_map.get(current, 0),
            )
        )
        current += timedelta(days=1)

    return BaseResponse(
        code=200,
        message="查询成功",
        data={
            "user_id": user_id,
            "days": days,
            "trend": [item.model_dump() for item in trend],
        },
    )


@router.post("/record", summary="新增运动记录")
def create_exercise_record(
    request: ExerciseRecordCreate,
    db: Session = Depends(get_db),
):
    """
    新增一条运动记录

    - **user_id**: 用户 ID
    - **exercise_type**: 运动类型（如：跑步、骑行、游泳）
    - **duration**: 运动时长（分钟）
    - **calorie**: 消耗热量（千卡）
    - **record_time**: 运动发生时间
    """
    # 校验用户是否存在
    _get_user_or_404(db, request.user_id)

    # 创建运动记录
    record = ExerciseRecord(
        record_id=_generate_id(),
        user_id=request.user_id,
        exercise_type=request.exercise_type,
        duration=request.duration,
        calorie=request.calorie,
        record_time=request.record_time,
        create_time=datetime.now(),
    )

    try:
        db.add(record)
        db.commit()
        db.refresh(record)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"保存运动记录失败: {exc}",
        ) from exc

    record_data = ExerciseRecordResponse.model_validate(record)

    return BaseResponse(
        code=200,
        message="运动记录创建成功",
        data=record_data.model_dump(),
    )


@router.get("/record/{user_id}", summary="获取用户运动记录列表")
def get_exercise_records(
    user_id: str,
    db: Session = Depends(get_db),
    limit: Optional[int] = Query(default=50, ge=1, le=200, description="返回条数上限"),
    offset: Optional[int] = Query(default=0, ge=0, description="偏移量"),
):
    """
    获取指定用户的运动记录列表

    按运动时间倒序排列，支持分页。
    """
    # 校验用户是否存在
    _get_user_or_404(db, user_id)

    # 查询总记录数
    total = (
        db.query(ExerciseRecord)
        .filter(ExerciseRecord.user_id == user_id)
        .count()
    )

    # 查询运动记录列表
    records = (
        db.query(ExerciseRecord)
        .filter(ExerciseRecord.user_id == user_id)
        .order_by(ExerciseRecord.record_time.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    record_list = [
        ExerciseRecordResponse.model_validate(r).model_dump()
        for r in records
    ]

    return BaseResponse(
        code=200,
        message="查询成功",
        data={
            "user_id": user_id,
            "total": total,
            "records": record_list,
        },
    )

@router.post("/record/clear", summary="清空用户全部运动记录")
def clear_exercise_records(
    request: ClearExerciseRecordsRequest,
    db: Session = Depends(get_db),
):
    """删除指定用户的全部运动记录"""
    user_id = request.user_id.strip()
    _get_user_or_404(db, user_id)

    try:
        deleted_count = (
            db.query(ExerciseRecord)
            .filter(ExerciseRecord.user_id == user_id)
            .delete(synchronize_session=False)
        )
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"清空失败: {exc}") from exc

    return BaseResponse(
        code=200,
        message="清空成功",
        data={"deleted_count": deleted_count},
    )


@router.delete("/record/{record_id}", summary="删除单条运动记录")
def delete_exercise_record(
    record_id: str,
    db: Session = Depends(get_db),
):
    """删除指定的运动记录"""
    record_id = record_id.strip()
    if not record_id:
        raise HTTPException(status_code=400, detail="记录ID不能为空")

    record = (
        db.query(ExerciseRecord)
        .filter(ExerciseRecord.record_id == record_id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")

    try:
        db.delete(record)
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"删除失败: {exc}") from exc

    return BaseResponse(
        code=200,
        message="删除成功",
        data={"record_id": record_id},
    )
