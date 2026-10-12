@echo off
title Sentinel V6 Launcher
cd /d "%~dp0src-tauri"
start "" "target\release\sentinel-desktop.exe"
exit
