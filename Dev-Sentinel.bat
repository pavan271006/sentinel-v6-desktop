@echo off
title Sentinel V6 — Live Dev Mode (Hot Reload)
cd /d "%~dp0"
echo ===================================================
echo   Sentinel V6: Starting Live Dev Environment
echo   Hot Module Replacement (HMR) Active
echo ===================================================
taskkill /IM sentinel-desktop.exe /F >nul 2>&1
call npm run dev:desktop
pause
