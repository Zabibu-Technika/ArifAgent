@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
if errorlevel 1 (
  echo.
  echo Installation failed. Review the message above.
  pause
  exit /b 1
)
echo.
echo Arif Agent is ready. Open a new terminal and run: arif-agent
pause
