@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo   轻养派后端 - 启动脚本
echo   目录: %cd%
echo ========================================

where python >nul 2>&1
if errorlevel 1 (
  echo [错误] 未找到 Python，请先安装 Python 3.10+ 并勾选 Add to PATH
  pause
  exit /b 1
)

echo [1/3] 检查依赖...
python -c "import uvicorn, fastapi" 2>nul
if errorlevel 1 (
  echo [提示] 正在安装依赖，请稍候...
  python -m pip install -r requirements.txt
  if errorlevel 1 (
    echo [错误] 依赖安装失败
    pause
    exit /b 1
  )
)

echo [2/3] 释放 8001 端口...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8001" ^| findstr "LISTENING"') do (
  echo   结束 PID %%a
  taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 /nobreak >nul

echo [3/3] 启动 API  http://0.0.0.0:8001
echo   真机调试请在 app.js 填写电脑局域网 IP，例如:
echo   http://192.168.x.x:8001
echo   按 Ctrl+C 可停止服务
echo ========================================

python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001
if errorlevel 1 (
  echo.
  echo [错误] 服务启动失败，请把上面红色报错截图发给我
  pause
  exit /b 1
)
