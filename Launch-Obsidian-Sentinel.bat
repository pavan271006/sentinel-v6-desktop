@echo off
title Launch Sentinel V6 Obsidian Vault
echo ========================================================
echo  Launching Sentinel V6 Architecture and Research Vault...
echo ========================================================

set "OBSIDIAN_EXE=%LOCALAPPDATA%\Programs\Obsidian\Obsidian.exe"
set "VAULT_PATH=%~dp0docs"

if exist "%OBSIDIAN_EXE%" (
    start "" "%OBSIDIAN_EXE%" "%VAULT_PATH%"
    echo Obsidian launched successfully!
) else (
    echo [!] Obsidian executable not found at: %OBSIDIAN_EXE%
    echo Opening vault directory in explorer instead...
    start "" "%VAULT_PATH%"
)
exit /b 0
