@echo off
echo 正在启动后端和cpolar...
start cmd /k "cd /d %~dp0 && uvicorn main:app --reload --host 0.0.0.0 --port 8001"
timeout /t 3 /nobreak >nul
start cmd /k "cd /d D:\neiwang_cpolar && cpolar http 8001"
echo.
echo ========================================
echo 后端和cpolar已启动!
echo 请在cpolar窗口复制域名,替换小程序中的API地址
echo ========================================
pause