"""
运动教练 Agent API
接入智谱 AI：GLM-4-Flash 对话、GLM-ASR 语音转写、运动热量估算
"""

import json
import os
import re
import tempfile
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from models import User

router = APIRouter(prefix="/api/agent", tags=["运动教练"])

ZHIPU_API_KEY = os.getenv(
    "ZHIPU_API_KEY",
    "fbdc33aa8a5a4a6bbdca317e4522997b.hX34r0BuhizAB5QP",
)

MODEL_NAME = "glm-4-flash"
ASR_MODEL_NAME = "glm-asr-2512"

# 运动教练系统提示词：强调专业、可执行、安全
SYSTEM_PROMPT = """你是「轻养派」小程序的专属运动健康教练，具备运动科学、体能训练与运动营养相关背景。

## 回答原则
1. **专业有据**：说明建议背后的逻辑（强度区间、恢复、适用人群），避免空泛鸡汤。
2. **可执行**：给出具体方案，例如「每周 3 次、每次 20–30 分钟、心率约 …」「可替代动作：…」。
3. **安全优先**：提醒热身/拉伸、循序渐进；有基础疾病或不适时建议就医，不替代医生诊断。
4. **个性化**：若用户提供年龄、身高、体重、BMI、运动习惯，需结合这些信息调整建议。
5. **结构清晰**：分点列出；单次回复宜 200–500 字，复杂问题可适当延长。

## 禁止
- 夸大疗效、推荐未经证实的偏方或极端节食/训练。
- 对伤病做确定性诊断。

语气亲切、务实，像一位靠谱私教，而不是营销号。"""

CALORIE_SYSTEM_PROMPT = (
    "你是运动生理学方向的热量估算助手。"
    "根据运动类型（含用户自定义项目名）、运动时长(分钟)和体重(kg)，"
    "为普通成年人估算运动消耗的千卡数。"
    "自定义运动请根据名称推断相近 MET（代谢当量），例如："
    "跳绳≈10、羽毛球≈5.5、爬山≈6.5、普拉提≈3.5、拳击≈9。"
    "必须只回复 JSON：{\"calorie\": 数字, \"met\": 数字可选}，"
    "calorie 保留一位小数，不要 markdown 或其它说明。"
)

MET_TABLE = {
    "跑步": 9.8,
    "散步": 3.5,
    "游泳": 8.0,
    "瑜伽": 3.0,
    "健身": 6.0,
    "骑行": 7.5,
    "跳绳": 10.0,
    "羽毛球": 5.5,
    "爬山": 6.5,
    "普拉提": 3.5,
    "拳击": 9.0,
    "其他": 5.0,
}

DEFAULT_WEIGHT_KG = 60.0
MAX_HISTORY_TURNS = 10


class ChatMessageItem(BaseModel):
    """对话历史单条"""

    role: str = Field(..., description="user 或 assistant")
    content: str = Field(..., min_length=1, max_length=2000)


class AgentChatRequest(BaseModel):
    """文字咨询请求"""

    message: str = Field(..., min_length=1, max_length=2000, description="用户问题")
    user_id: Optional[str] = Field(None, max_length=32, description="用户ID，用于个性化")
    history: List[ChatMessageItem] = Field(
        default_factory=list,
        description="最近对话历史，用于多轮上下文",
    )


class AgentChatData(BaseModel):
    reply: str
    recognized_text: Optional[str] = Field(None, description="语音咨询时返回识别文本")


class AgentChatResponse(BaseModel):
    code: int = 200
    message: str = "success"
    data: Optional[AgentChatData] = None


class SpeechToTextData(BaseModel):
    """语音转文字结果"""

    text: str = Field(..., description="识别出的文字")


class SpeechToTextResponse(BaseModel):
    code: int = 200
    message: str = "success"
    data: Optional[SpeechToTextData] = None


# 智谱 ASR 音频时长上限（秒）
ASR_MAX_DURATION_SEC = 30


class CalorieEstimateRequest(BaseModel):
    exercise_type: str = Field(..., min_length=1, max_length=30, description="运动类型")
    custom_exercise_type: Optional[str] = Field(
        None,
        max_length=30,
        description="选择「其他」时填写的自定义运动名称",
    )
    duration: int = Field(..., gt=0, le=600, description="运动时长(分钟)")
    weight: float = Field(default=DEFAULT_WEIGHT_KG, gt=0, le=200, description="体重(kg)")


class CalorieEstimateData(BaseModel):
    calorie: float
    source: str = Field(description="ai 或 formula")
    exercise_type: str
    duration: int
    met: Optional[float] = None


class CalorieEstimateResponse(BaseModel):
    code: int = 200
    message: str = "success"
    data: Optional[CalorieEstimateData] = None


def _resolve_exercise_type(exercise_type: str, custom_exercise_type: Optional[str]) -> str:
    """解析最终运动类型名称（「其他」时使用自定义名称）"""
    exercise_type = exercise_type.strip()
    if exercise_type == "其他" and custom_exercise_type:
        custom = custom_exercise_type.strip()
        if custom:
            return custom
    return exercise_type


def _local_estimate_calorie(exercise_type: str, duration: int, weight: float) -> tuple[float, float]:
    """MET 公式兜底：千卡 = MET × 体重(kg) × 小时数"""
    met = MET_TABLE.get(exercise_type)
    if met is None:
        # 自定义类型：尝试模糊匹配常见词
        for key, value in MET_TABLE.items():
            if key != "其他" and key in exercise_type:
                met = value
                break
        if met is None:
            met = MET_TABLE["其他"]
    hours = duration / 60.0
    calorie = round(met * weight * hours, 1)
    return calorie, met


def _parse_calorie_from_ai_text(text: str) -> Optional[float]:
    if not text:
        return None
    text = text.strip()
    try:
        obj = json.loads(text)
        if isinstance(obj, dict) and "calorie" in obj:
            return float(obj["calorie"])
    except (json.JSONDecodeError, TypeError, ValueError):
        pass
    match = re.search(r'"calorie"\s*:\s*(\d+(?:\.\d+)?)', text)
    if match:
        return float(match.group(1))
    match = re.search(r"(\d+(?:\.\d+)?)\s*(?:千卡|kcal)?", text)
    if match:
        value = float(match.group(1))
        if 0 < value < 5000:
            return value
    return None


def _raise_zhipu_error(exc: Exception) -> None:
    err_msg = str(exc).lower()
    err_raw = str(exc)
    if "1214" in err_raw or ("transcription" in err_msg and "30" in err_msg):
        raise HTTPException(
            status_code=400,
            detail="录音时长需在30秒以内，请缩短录音后重试",
        ) from exc
    if any(
        key in err_msg
        for key in ("api key", "apikey", "authentication", "unauthorized", "401", "鉴权")
    ):
        raise HTTPException(status_code=401, detail="智谱 API Key 无效或已过期") from exc
    if any(key in err_msg for key in ("timeout", "timed out", "超时")):
        raise HTTPException(status_code=504, detail="AI 服务响应超时") from exc
    if any(key in err_msg for key in ("rate limit", "quota", "余额", "429")):
        raise HTTPException(status_code=429, detail="AI 服务繁忙或额度不足") from exc
    raise HTTPException(status_code=500, detail=f"AI 服务调用失败: {exc}") from exc


def _get_zhipu_client():
    try:
        from zhipuai import ZhipuAI
    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail="未安装 zhipuai 依赖，请执行: pip install zhipuai",
        ) from exc
    return ZhipuAI(api_key=ZHIPU_API_KEY, timeout=90)


def _build_user_context(db: Session, user_id: Optional[str]) -> str:
    """根据用户档案生成个性化上下文"""
    if not user_id:
        return ""
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        return ""
    parts = []
    if user.nickname:
        parts.append(f"昵称：{user.nickname}")
    if user.age:
        parts.append(f"年龄：{user.age}岁")
    if user.height:
        parts.append(f"身高：{user.height}cm")
    if user.weight:
        parts.append(f"体重：{user.weight}kg")
    if user.bmi:
        parts.append(f"BMI：{round(user.bmi, 1)}")
    if not parts:
        return ""
    return "【用户档案】" + "，".join(parts) + "\n"


def _build_chat_messages(
    user_message: str,
    user_context: str,
    history: List[ChatMessageItem],
) -> list[dict]:
    """组装发给大模型的 messages 列表"""
    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]

    # 注入用户档案（若有）
    if user_context:
        messages.append(
            {
                "role": "system",
                "content": f"以下为当前咨询用户的身体数据，请结合给出建议：\n{user_context}",
            }
        )

    # 多轮历史（仅保留最近若干轮）
    trimmed = history[-MAX_HISTORY_TURNS * 2 :] if history else []
    for item in trimmed:
        role = item.role if item.role in ("user", "assistant") else "user"
        messages.append({"role": role, "content": item.content.strip()})

    messages.append({"role": "user", "content": user_message})
    return messages


def _invoke_coach_chat(messages: list[dict]) -> str:
    """调用智谱对话并返回回复文本"""
    client = _get_zhipu_client()
    response = client.chat.completions.create(
        model=MODEL_NAME,
        messages=messages,
        temperature=0.55,
        top_p=0.85,
    )
    if not response.choices:
        raise HTTPException(status_code=502, detail="AI 未返回有效内容")
    reply = response.choices[0].message.content
    if not reply:
        raise HTTPException(status_code=502, detail="AI 返回内容为空")
    return reply.strip()


def _transcribe_audio(file_bytes: bytes, filename: str) -> str:
    """调用智谱 GLM-ASR 将音频转为文字"""
    client = _get_zhipu_client()
    suffix = os.path.splitext(filename)[1] or ".mp3"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name
    try:
        with open(tmp_path, "rb") as audio_file:
            response = client.audio.transcriptions.create(
                model=ASR_MODEL_NAME,
                file=audio_file,
                stream=False,
            )
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    # 兼容多种 SDK 返回格式
    if isinstance(response, str):
        text = response.strip()
    elif hasattr(response, "text") and response.text:
        text = str(response.text).strip()
    elif isinstance(response, dict):
        text = str(response.get("text", "")).strip()
    else:
        text = ""
        if hasattr(response, "__iter__"):
            for item in response:
                if hasattr(item, "text") and item.text:
                    text += str(item.text)
                elif isinstance(item, dict) and item.get("text"):
                    text += str(item["text"])
        text = text.strip()

    if not text:
        raise HTTPException(status_code=502, detail="语音识别结果为空，请重试")
    return text


@router.post("/estimate-calorie", response_model=CalorieEstimateResponse)
def estimate_calorie(body: CalorieEstimateRequest):
    """
    根据运动类型与时长估算热量（千卡）
    选择「其他」时请传 custom_exercise_type 为自定义运动名称
    """
    exercise_type = _resolve_exercise_type(body.exercise_type, body.custom_exercise_type)
    if body.exercise_type.strip() == "其他" and not body.custom_exercise_type:
        raise HTTPException(status_code=400, detail="选择「其他」时请填写自定义运动类型")

    duration = body.duration
    weight = body.weight

    calorie: Optional[float] = None
    met_used: Optional[float] = None
    source = "formula"

    try:
        client = _get_zhipu_client()
        user_prompt = (
            f"运动类型：{exercise_type}\n"
            f"运动时长：{duration} 分钟\n"
            f"体重：{weight} kg"
        )
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": CALORIE_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
        )
        if response.choices:
            raw = response.choices[0].message.content or ""
            parsed = _parse_calorie_from_ai_text(raw)
            if parsed is not None and parsed > 0:
                calorie = round(parsed, 1)
                source = "ai"
    except HTTPException:
        raise
    except Exception:
        pass

    if calorie is None:
        calorie, met_used = _local_estimate_calorie(exercise_type, duration, weight)
        source = "formula"
    else:
        _, met_used = _local_estimate_calorie(exercise_type, duration, weight)

    return CalorieEstimateResponse(
        code=200,
        message="success",
        data=CalorieEstimateData(
            calorie=calorie,
            source=source,
            exercise_type=exercise_type,
            duration=duration,
            met=met_used,
        ),
    )


@router.post("/speech-to-text", response_model=SpeechToTextResponse)
async def speech_to_text(
    file: UploadFile = File(..., description="录音文件，建议 mp3，时长不超过30秒"),
):
    """
    仅做语音转文字，不调用对话模型。
    小程序应先转写、展示/编辑文字，再由用户确认后调用 /chat 发送文本。
    """
    if not file.filename and not file.content_type:
        raise HTTPException(status_code=400, detail="请上传音频文件")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="音频文件为空")
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="音频文件不能超过 10MB")

    filename = file.filename or "voice.mp3"

    try:
        text = _transcribe_audio(file_bytes, filename)
    except HTTPException:
        raise
    except Exception as exc:
        _raise_zhipu_error(exc)

    return SpeechToTextResponse(
        code=200,
        message="success",
        data=SpeechToTextData(text=text),
    )


@router.post("/chat", response_model=AgentChatResponse)
def agent_chat(body: AgentChatRequest, db: Session = Depends(get_db)):
    """运动教练文字咨询（支持多轮历史与用户档案）"""
    message = body.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="message 不能为空")

    user_context = _build_user_context(db, body.user_id)
    messages = _build_chat_messages(message, user_context, body.history)

    try:
        reply = _invoke_coach_chat(messages)
        return AgentChatResponse(
            code=200,
            message="success",
            data=AgentChatData(reply=reply),
        )
    except HTTPException:
        raise
    except Exception as exc:
        _raise_zhipu_error(exc)


@router.post("/voice-chat", response_model=AgentChatResponse)
async def agent_voice_chat(
    file: UploadFile = File(..., description="录音文件，支持 mp3/wav/m4a"),
    user_id: Optional[str] = Form(None, description="用户ID"),
    history: Optional[str] = Form(
        None,
        description='JSON 字符串，对话历史 [{"role":"user","content":"..."}]',
    ),
    db: Session = Depends(get_db),
):
    """
    运动教练语音咨询：先语音转文字，再生成专业回复
    小程序使用 wx.uploadFile 上传录音文件
    """
    if not file.filename and not file.content_type:
        raise HTTPException(status_code=400, detail="请上传音频文件")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="音频文件为空")
    if len(file_bytes) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="音频文件不能超过 25MB")

    filename = file.filename or "voice.mp3"

    # 解析可选对话历史
    history_list: List[ChatMessageItem] = []
    if history:
        try:
            raw_history = json.loads(history)
            if isinstance(raw_history, list):
                history_list = [ChatMessageItem(**item) for item in raw_history[-20:]]
        except (json.JSONDecodeError, TypeError, ValueError):
            pass

    try:
        recognized_text = _transcribe_audio(file_bytes, filename)
    except HTTPException:
        raise
    except Exception as exc:
        _raise_zhipu_error(exc)

    user_context = _build_user_context(db, user_id)
    messages = _build_chat_messages(recognized_text, user_context, history_list)

    try:
        reply = _invoke_coach_chat(messages)
        return AgentChatResponse(
            code=200,
            message="success",
            data=AgentChatData(reply=reply, recognized_text=recognized_text),
        )
    except HTTPException:
        raise
    except Exception as exc:
        _raise_zhipu_error(exc)
