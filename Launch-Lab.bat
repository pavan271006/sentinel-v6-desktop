@echo off
title Launch Sentinel V6 Target Lab
echo ========================================================
echo  Starting Sentinel V6 Local Vulnerability Target Lab...
echo ========================================================
docker compose -f "%~dp0docker-compose.lab.yml" up -d
echo.
echo --------------------------------------------------------
echo  Lab Targets Online:
echo   - OWASP Juice Shop:  http://localhost:3000
echo   - DVWA:              http://localhost:8081
echo   - DVGA (GraphQL):    http://localhost:5013
echo   - PostgreSQL 16:     localhost:5432 (user: sentinel, pass: labpassword123)
echo   - MySQL 8.0:         localhost:3306 (user: root, pass: labpassword123)
echo   - ClickHouse Server: http://localhost:8123 (native: 9000)
echo --------------------------------------------------------
pause
