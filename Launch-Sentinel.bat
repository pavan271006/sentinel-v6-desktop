@echo off
title Sentinel V6 Pentester Desktop
cd /d "%~dp0src-tauri"
taskkill /IM sentinel-desktop.exe /F >nul 2>&1
ping 127.0.0.1 -n 2 >nul
start "" "target\release\sentinel-desktop.exe"
exit
