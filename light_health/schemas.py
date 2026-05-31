"""
Pydantic 数据验证模型
用于 API 请求参数校验和响应数据序列化
"""

from datetime import datetime, date
from typing import List, Optional

from pydantic import BaseModel, Field, ConfigDict


# ==================== 通用响应模型 ====================


class BaseResponse(BaseModel):
    """统一 API 响应结构"""

    code: int = Field(default=200, description="状态码，200 表示成功")
    message: str = Field(default="success", description="响应消息")
    data: Optional[dict | list] = Field(default=None, description="响应数据")


# ==================== 用户相关模型 ====================


class UserCreate(BaseModel):
    """创建用户请求模型"""

    user_id: str = Field(..., max_length=32, description="用户ID")
    wechat_id: str = Field(..., max_length=50, description="微信OpenID")
    nickname: Optional[str] = Field(None, max_length=20, description="昵称")
    height: Optional[float] = Field(None, ge=0, description="身高(cm)")
    weight: Optional[float] = Field(None, ge=0, description="体重(kg)")
    age: Optional[int] = Field(None, ge=0, le=150, description="年龄")
    bmi: Optional[float] = Field(None, ge=0, description="BMI指数")


class UserResponse(BaseModel):
    """用户信息响应模型"""

    model_config = ConfigDict(from_attributes=True)

    user_id: str
    wechat_id: str
    nickname: Optional[str] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    age: Optional[int] = None
    bmi: Optional[float] = None
    create_time: datetime


# ==================== 微信步数同步相关模型 ====================


class WerunSyncRequest(BaseModel):
    """微信运动步数同步请求模型"""

    user_id: str = Field(..., max_length=32, description="用户ID")
    encryptedData: str = Field(..., description="微信加密数据")
    iv: str = Field(..., description="加密算法初始向量")
    session_key: str = Field(..., description="微信会话密钥")
    dev_step_count: Optional[int] = Field(
        None,
        ge=0,
        description="开发模式模拟步数（未配置 AppSecret 时使用）",
    )


class WerunSyncResponse(BaseModel):
    """微信运动步数同步响应数据"""

    user_id: str
    step_count: int = Field(description="今日/最新步数")
    stat_date: date = Field(description="统计日期")
    synced: bool = Field(description="是否同步成功")
    synced_days: int = Field(default=1, description="本次同步写入的天数")


class WerunTrendItem(BaseModel):
    """步数趋势单日数据项"""

    stat_date: date = Field(description="日期")
    step_count: int = Field(description="步数")


class WerunTrendResponse(BaseModel):
    """步数趋势响应数据"""

    user_id: str
    days: int
    trend: List[WerunTrendItem]


# ==================== 运动记录相关模型 ====================


class ExerciseRecordCreate(BaseModel):
    """新增运动记录请求模型"""

    user_id: str = Field(..., max_length=32, description="用户ID")
    exercise_type: str = Field(..., max_length=30, description="运动类型")
    duration: int = Field(..., gt=0, description="运动时长(分钟)")
    calorie: float = Field(..., ge=0, description="消耗热量(千卡)")
    record_time: datetime = Field(..., description="运动时间")


class ExerciseRecordResponse(BaseModel):
    """运动记录响应模型"""

    model_config = ConfigDict(from_attributes=True)

    record_id: str
    user_id: str
    exercise_type: str
    duration: int
    calorie: float
    record_time: datetime
    create_time: datetime


class ExerciseRecordListResponse(BaseModel):
    """运动记录列表响应数据"""

    user_id: str
    total: int
    records: List[ExerciseRecordResponse]


class ClearExerciseRecordsRequest(BaseModel):
    """清空用户运动记录请求"""

    user_id: str = Field(..., max_length=32, description="用户ID")
