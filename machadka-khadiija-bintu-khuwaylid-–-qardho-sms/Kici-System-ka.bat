@echo off
title Machadka Qardho SMS
cd /d "%~dp0"
echo ============================================
echo   Machadka Khadiija Bintu Khuwaylid - Qardho
echo   System-ka waa la kicinayaa...
echo   Daaqaddan HA XIRIN inta aad isticmaalayso.
echo ============================================
echo Qaybaha loo baahan yahay waa la hubinayaa - npm install...
call npm install --no-audit --no-fund
start "" cmd /c "timeout /t 8 /nobreak >nul & start http://localhost:3000"
call npm run dev
pause
