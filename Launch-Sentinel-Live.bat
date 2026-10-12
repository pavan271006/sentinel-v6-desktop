@echo off
title Sentinel V6 Live Auto-Update Launcher
cd /d "%~dp0"
echo ===================================================
echo Starting Sentinel V6 in Live Auto-Update Mode (HMR)
echo Any changes made to code will update the app instantly!
echo ===================================================
npm run dev:desktop
