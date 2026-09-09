@echo off
title Stop Sentinel V6 Target Lab
echo ========================================================
echo  Stopping Sentinel V6 Local Vulnerability Target Lab...
echo ========================================================
docker compose -f "%~dp0docker-compose.lab.yml" down
echo.
echo All test containers stopped cleanly.
pause
