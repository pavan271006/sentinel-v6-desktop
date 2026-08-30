@echo off
cd /d "c:\Users\Legion 5 pro\Desktop\cyber sec"
start /b cmd /c "npm run dev"
timeout /t 2 /nobreak >nul
start "" "c:\Users\Legion 5 pro\Desktop\cyber sec\src-tauri\target\debug\sentinel-desktop.exe"
