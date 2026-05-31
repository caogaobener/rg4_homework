#!/usr/bin/env python3
"""
从本地 MySQL 导出数据，用于导入微信云开发数据库

用法：
  1. 确保 MySQL 已启动且 light_health 库有数据
  2. python export_to_cloud.py
  3. 生成 cloud_import.json
  4. 在微信开发者工具 → 云开发 → 云函数 → api → 云端测试，传入：
     {
       "action": "importData",
       "migrate_token": "你在云函数环境变量 MIGRATE_TOKEN 中设置的值",
       "exercise_records": [...从 json 文件复制...],
       "werun_data": [...]
     }
"""

import json
from datetime import date, datetime

from database import SessionLocal
from models import ExerciseRecord, WerunData


def to_json(obj):
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    return obj


def main():
    db = SessionLocal()
    try:
        records = db.query(ExerciseRecord).all()
        werun = db.query(WerunData).all()

        data = {
            "exercise_records": [
                {
                    "record_id": r.record_id,
                    "user_id": r.user_id,
                    "exercise_type": r.exercise_type,
                    "duration": r.duration,
                    "calorie": float(r.calorie),
                    "record_time": to_json(r.record_time),
                    "create_time": to_json(r.create_time),
                }
                for r in records
            ],
            "werun_data": [
                {
                    "data_id": w.data_id,
                    "user_id": w.user_id,
                    "step_count": w.step_count,
                    "stat_date": to_json(w.stat_date),
                }
                for w in werun
            ],
        }

        out = "cloud_import.json"
        with open(out, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print(f"导出完成: {len(data['exercise_records'])} 条运动记录, {len(data['werun_data'])} 条步数")
        print(f"文件: {out}")
        print("\n下一步：在云函数 api 的环境变量设置 MIGRATE_TOKEN，然后云端测试 importData")
    finally:
        db.close()


if __name__ == "__main__":
    main()
