@echo off
chcp 65001 >nul
set "BACKEND=e:\light_health"
if not exist "%BACKEND%\start_server.bat" (
  echo [错误] 找不到后端目录: %BACKEND%
  echo 请确认 light_health 项目在 E 盘，或修改本文件里的 BACKEND 路径
  pause
  exit /b 1
)
cd /d "%BACKEND%"
call "%BACKEND%\start_server.bat"
