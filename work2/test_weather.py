# test_weather.py
from weather_api import get_weather, query_forecast

print("===== 天气模块测试 =====")

# 测试1：北京天气（含3天预报）
print("\n【测试1】北京天气：")
res1 = get_weather("北京")
print(f"状态：{'成功' if res1['success'] else '失败'}")
print(f"当前天气：{res1['text']} {res1['temp']}℃")
print("3天预报：")
for day in res1['forecast']:
    print(f"  {day['date']}：{day['text']} {day['temp_min']}~{day['temp_max']}℃")

# 测试2：上海3天预报（单独调用）
print("\n【测试2】上海3天预报：")
res2 = query_forecast("上海")
print(f"状态：{'成功' if res2['success'] else '失败'}")
print("预报数据：")
for day in res2['forecasts']:
    print(f"  {day['date']}：{day['text']} {day['temp_min']}~{day['temp_max']}℃")

# 测试3：广州天气
print("\n【测试3】广州天气：")
res3 = get_weather("广州")
print(f"状态：{'成功' if res3['success'] else '失败'}")
print(f"当前天气：{res3['text']} {res3['temp']}℃")
print("3天预报：")
for day in res3['forecast']:
    print(f"  {day['date']}：{day['text']} {day['temp_min']}~{day['temp_max']}℃")