
# weather_api.py - 成员2 最终完美版（无KEY、零配置、直接运行）
import requests

BASE_GEO_URL = "https://geocoding-api.open-meteo.com/v1/search"
BASE_WEATHER_URL = "https://api.open-meteo.com/v1/forecast"

def get_city_location(city: str) -> dict:
    params = {
        "name": city,
        "count": 1,
        "language": "zh",
        "format": "json"
    }
    try:
        response = requests.get(BASE_GEO_URL, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        if data.get("results") and len(data["results"]) > 0:
            result = data["results"][0]
            return {
                "name": result["name"],
                "latitude": result["latitude"],
                "longitude": result["longitude"]
            }
        else:
            print(f"❌ 未找到城市：{city}")
            return None
    except Exception as e:
        print(f"❌ 城市定位失败：{str(e)}")
        return None

def get_weather(city: str) -> dict:
    location = get_city_location(city)
    if not location:
        return {"success": False, "error": f"未找到{city}的地理信息"}
    
    lat = location["latitude"]
    lon = location["longitude"]

    params = {
        "latitude": lat,
        "longitude": lon,
        "current": ["temperature_2m", "relative_humidity_2m", "weather_code", "wind_speed_10m", "wind_direction_10m"],
        "daily": ["weather_code", "temperature_2m_max", "temperature_2m_min"],
        "timezone": "auto",
        "language": "zh"
    }

    try:
        response = requests.get(BASE_WEATHER_URL, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        weather_map = {
            0: "晴朗", 1: "大部晴朗", 2: "多云", 3: "阴天",
            45: "雾", 48: "雾凇", 51: "毛毛雨", 53: "小雨", 55: "大雨",
            61: "小雨", 63: "中雨", 65: "大雨", 71: "小雪", 73: "中雪", 75: "大雪",
            80: "阵雨", 81: "雷阵雨", 82: "强雷阵雨", 95: "雷暴", 96: "雷暴伴冰雹", 99: "强雷暴伴冰雹"
        }

        current = data["current"]
        now_weather = weather_map.get(current["weather_code"], "未知天气")
        wind_dir = f"{current['wind_direction_10m']}°"
        wind_scale = f"{round(current['wind_speed_10m'] / 3.6, 1)}级"

        daily = data["daily"]
        forecast_list = []
        date_map = {0: "今天", 1: "明天", 2: "后天"}
        for i in range(3):
            forecast_list.append({
                "date": date_map[i],
                "text": weather_map.get(daily["weather_code"][i], "未知天气"),
                "temp_min": int(daily["temperature_2m_min"][i]),
                "temp_max": int(daily["temperature_2m_max"][i])
            })

        return {
            "success": True,
            "city": location["name"],
            "text": now_weather,
            "temp": int(current["temperature_2m"]),
            "humidity": int(current["relative_humidity_2m"]),
            "wind": f"{wind_dir}{wind_scale}",
            "forecast": forecast_list
        }
    except Exception as e:
        return {"success": False, "error": f"天气查询失败：{str(e)}"}

def query_forecast(city: str, days: int = 3) -> dict:
    location = get_city_location(city)
    if not location:
        return {"success": False, "error": f"未找到{city}的地理信息"}
    
    lat = location["latitude"]
    lon = location["longitude"]

    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": ["weather_code", "temperature_2m_max", "temperature_2m_min"],
        "timezone": "auto",
        "language": "zh"
    }

    try:
        response = requests.get(BASE_WEATHER_URL, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        weather_map = {
            0: "晴朗", 1: "大部晴朗", 2: "多云", 3: "阴天",
            45: "雾", 48: "雾凇", 51: "毛毛雨", 53: "小雨", 55: "大雨",
            61: "小雨", 63: "中雨", 65: "大雨", 71: "小雪", 73: "中雪", 75: "大雪",
            80: "阵雨", 81: "雷阵雨", 82: "强雷阵雨", 95: "雷暴", 96: "雷暴伴冰雹", 99: "强雷暴伴冰雹"
        }

        daily = data["daily"]
        forecasts = []
        date_map = {0: "今天", 1: "明天", 2: "后天"}
        for i in range(min(days, 3)):
            forecasts.append({
                "date": date_map[i],
                "text": weather_map.get(daily["weather_code"][i], "未知天气"),
                "temp_min": int(daily["temperature_2m_min"][i]),
                "temp_max": int(daily["temperature_2m_max"][i])
            })

        return {
            "success": True,
            "city": location["name"],
            "forecasts": forecasts
        }
    except Exception as e:
        return {"success": False, "error": f"预报查询失败：{str(e)}"}

if __name__ == "__main__":
    print("\n===== 成员2-天气API模块本地自测 =====\n")
    print("1. 测试北京实时天气+3天预报：")
    print(get_weather("北京"))
    print("\n2. 测试上海3天预报：")
    print(query_forecast("上海"))
    print("\n3. 测试广州天气：")
    print(get_weather("广州"))
