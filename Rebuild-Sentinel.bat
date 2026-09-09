@echo off
title Sentinel V6 — Clean Rebuild ^& Launch
cd /d "%~dp0"
echo ===================================================
echo   Sentinel V6: Rebuilding Frontend ^& Backend...
echo ===================================================
taskkill /IM sentinel-desktop.exe /F >nul 2>&1
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Frontend build failed!
    pause
    exit /b %errorlevel%
)
cargo build --release --manifest-path src-tauri/Cargo.toml
if %errorlevel% neq 0 (
    echo [ERROR] Rust backend build failed!
    pause
    exit /b %errorlevel%
)
echo [OK] Launching Sentinel Desktop...
start "" "%~dp0src-tauri\target\release\sentinel-desktop.exe"
exit
