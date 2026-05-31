轻养派个人健康管理助手 - API 接口说明文档
对应数据库表： user、food_record、exercise_record、medicine、medicine_reminder、health_report
一、接口说明
本文档为前后端对接标准，所有接口返回统一 JSON 格式。
二、用户模块（对应 user 表）
1. 微信登录接口
接口地址：/api/user/login
请求方式：POST
功能：微信 code 换取 openid，自动创建用户
请求参数：
plaintext
code: String  // 小程序 wx.login() 获取
返回结果：
json
{
  "code": 200,
  "msg": "登录成功",
  "data": {
    "user_id": "1001",
    "wechat_id": "oXxxxxx",
    "nickname": "用户昵称"
  }
}
2. 获取个人档案
接口地址：/api/user/profile
请求方式：GET
功能：获取用户身高、体重、年龄、BMI
请求参数：
plaintext
user_id: String
返回结果：
json
{
  "code": 200,
  "data": {
    "height": 175,
    "weight": 65,
    "age": 22,
    "bmi": 21.2,
    "gender": "男"
  }
}
3. 保存 / 更新个人档案
接口地址：/api/user/profile/save
请求方式：POST
功能：新增或修改档案信息
请求参数：
json
{
  "user_id": "1001",
  "height": 175,
  "weight": 65,
  "age": 22,
  "bmi": 21.2,
  "gender": "男"
}
返回结果：
json
{
  "code": 200,
  "msg": "保存成功"
}
三、饮食记录模块（对应 food_record 表）
1. 获取饮食记录列表
地址：/api/food/list
参数：user_id
返回：食物名称、热量、记录时间
2. 添加饮食记录
地址：/api/food/add
参数：user_id, food_name, calorie, record_type
返回：添加成功
3. 删除饮食记录
地址：/api/food/delete
参数：record_id
返回：删除成功
四、运动记录模块（对应 exercise_record 表）
1. 获取运动记录列表
地址：/api/exercise/list
参数：user_id
2. 添加运动记录
地址：/api/exercise/add
参数：user_id, exercise_type, duration, calorie
五、药品与用药提醒（对应 medicine、medicine_reminder 表）
1. 获取药品列表
地址：/api/medicine/list
参数：user_id
2. 添加药品
地址：/api/medicine/add
3. 添加用药提醒
地址：/api/medicine/remind/add
参数：medicine_id, reminder_time
六、健康日报模块（对应 health_report 表）
获取当日健康报告
地址：/api/report/get
参数：user_id, report_date
返回：饮食分析、运动分析、用药分析
七、统一返回格式
json
{
  "code": 200,        // 200=成功 500=失败
  "msg": "提示信息",
  "data": {}          // 业务数据
}
