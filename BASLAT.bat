@echo off
chcp 65001 > nul
title GastroSmart POS - Baslat

echo.
echo  ================================================
echo     GastroSmart POS
echo  ================================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  HATA: Node.js bulunamadi!
    echo  https://nodejs.org adresinden LTS indirin.
    pause
    exit /b 1
)

where pm2 >nul 2>&1
if %errorlevel% neq 0 (
    echo  PM2 kuruluyor...
    call npm install -g pm2
    if %errorlevel% neq 0 (
        echo  HATA: PM2 kurulamadi!
        pause
        exit /b 1
    )
)

sc query MongoDB | find "RUNNING" >nul 2>&1
if %errorlevel% neq 0 (
    echo  MongoDB baslatiliyor...
    net start MongoDB >nul 2>&1
    timeout /t 2 /nobreak >nul
)

if not exist "%~dp0backend\node_modules" (
    echo  Backend kurulumu yapiliyor...
    pushd "%~dp0backend"
    call npm install --silent
    popd
)

pm2 describe gastrosmart-backend >nul 2>&1
if %errorlevel% neq 0 (
    echo  Backend baslatiliyor...
    pm2 start "%~dp0ecosystem.config.js" --env production
) else (
    pm2 restart gastrosmart-backend >nul 2>&1
)

timeout /t 2 /nobreak >nul

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set "SERVER_IP=%%a"
    goto :found_ip
)
:found_ip
set "SERVER_IP=%SERVER_IP: =%"

start "" "http://localhost:3001"

echo.
echo  ================================================
echo   Sistem Calisiyor!
echo.
echo   Bu Bilgisayar   : http://localhost:3001
echo   Tablet/Telefon  : http://%SERVER_IP%:3001
echo.
echo   Log izle : pm2 logs gastrosmart-backend
echo   Durdur   : DURDUR.bat
echo  ================================================
echo.
pause
