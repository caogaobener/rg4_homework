"""
数据库 ORM 模型定义
对应 MySQL 中的 user、exercise_record、werun_data 三张表
"""

from datetime import datetime, date

from sqlalchemy import (
    Column,
    String,
    Integer,
    Double,
    DateTime,
    Date,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
  """用户表：存储小程序用户基本信息及身体数据"""

  __tablename__ = "user"

  # 用户唯一标识（主键）
  user_id = Column(String(32), primary_key=True, comment="用户ID")
  # 微信 OpenID，唯一索引
  wechat_id = Column(String(50), unique=True, nullable=False, index=True, comment="微信OpenID")
  # 用户昵称
  nickname = Column(String(20), nullable=True, comment="昵称")
  # 身高（厘米）
  height = Column(Double, nullable=True, comment="身高(cm)")
  # 体重（千克）
  weight = Column(Double, nullable=True, comment="体重(kg)")
  # 年龄
  age = Column(Integer, nullable=True, comment="年龄")
  # 身体质量指数
  bmi = Column(Double, nullable=True, comment="BMI指数")
  # 账号创建时间
  create_time = Column(DateTime, default=datetime.now, comment="创建时间")

  # 关联关系：一个用户可有多条运动记录
  exercise_records = relationship("ExerciseRecord", back_populates="user")
  # 关联关系：一个用户可有多条微信步数记录
  werun_records = relationship("WerunData", back_populates="user")


class ExerciseRecord(Base):
  """运动记录表：记录用户每次运动的类型、时长和消耗热量"""

  __tablename__ = "exercise_record"

  # 记录唯一标识（主键）
  record_id = Column(String(32), primary_key=True, comment="记录ID")
  # 关联用户 ID（外键）
  user_id = Column(
      String(32),
      ForeignKey("user.user_id", ondelete="CASCADE"),
      nullable=False,
      index=True,
      comment="用户ID",
  )
  # 运动类型，如：跑步、游泳, 游泳等
  exercise_type = Column(String(30), nullable=False, comment="运动类型")
  # 运动时长（分钟）
  duration = Column(Integer, nullable=False, comment="运动时长(分钟)")
  # 消耗热量（千卡）
  calorie = Column(Double, nullable=False, comment="消耗热量(千卡)")
  # 运动发生时间
  record_time = Column(DateTime, nullable=False, comment="运动时间")
  # 记录创建时间
  create_time = Column(DateTime, default=datetime.now, comment="创建时间")

  # 反向关联用户
  user = relationship("User", back_populates="exercise_records")


class WerunData(Base):
  """微信运动步数表：存储用户每日微信步数同步数据"""

  __tablename__ = "werun_data"

  # 数据唯一标识（主键）
  data_id = Column(String(32), primary_key=True, comment="数据ID")
  # 关联用户 ID（外键）
  user_id = Column(
      String(32),
      ForeignKey("user.user_id", ondelete="CASCADE"),
      nullable=False,
      index=True,
      comment="用户ID",
  )
  # 当日步数
  step_count = Column(Integer, nullable=False, default=0, comment="步数")
  # 统计日期
  stat_date = Column(Date, nullable=False, comment="统计日期")
  # 首次创建时间
  create_time = Column(DateTime, default=datetime.now, comment="创建时间")
  # 最后更新时间
  update_time = Column(
      DateTime,
      default=datetime.now,
      onupdate=datetime.now,
      comment="更新时间",
  )

  # 同一用户同一天只允许一条步数记录
  __table_args__ = (
      UniqueConstraint("user_id", "stat_date", name="uq_user_stat_date"),
  )

  # 反向关联用户
  user = relationship("User", back_populates="werun_records")
