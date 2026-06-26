@echo off
echo Launching 00Product-AI Server...
cd /d "%~dp0"
PowerShell.exe -NoProfile -ExecutionPolicy Bypass -File "launch-server.ps1"
pause
