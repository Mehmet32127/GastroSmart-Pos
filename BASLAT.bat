@echo off
chcp 65001 > nul
title GastroSmart POS - Başlat

echo.
echo  ════════════════════════════════════════════════
echo     GastroSmart POS
echo  ════════════════════════════════════════════════
echo.

:: Node.js kontrolü
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  HATA: Node.js bulunamadı!
    echo  https://nodejs.org adresinden LTS sürümü indirin.
    pause
    exit /b 1
)

:: PM2 kontrolü
where pm2 >nul 2>&1
if %errorlevel% neq 0 (
    echo  PM2 kuruluyor...
    call npm install -g pm2
)

:: MongoDB kontrolü
sc query MongoDB | find "RUNNING" >nul 2>&1
if %errorlevel% neq 0 (
    echo  MongoDB başlatılıyor...
    net start MongoDB >nul 2>&1
    timeout /t 2 /nobreak >nul
)

:: Backend bağımlılıkları
if not exist "%~dp0backend\node_modules" (
    echo  Backend kurulumu yapılıyor...
    cd /d "%~dp0backend"
    call npm install --silent
    cd /d "%~dp0"
)

:: Frontend bağımlılıkları
if not exist "%~dp0frontend\node_modules" (
    echo  Frontend kurulumu yapılıyor...
    cd /d "%~dp0frontend"
    call npm install --silent
    cd /d "%~dp0"
)

:: Backend'i PM2 ile başlat
pm2 describe gastrosmart-backend >nul 2>&1
if %errorlevel% neq 0 (
    echo  Backend başlatılıyor...
    cd /d "%~dp0backend"
    pm2 start server.js --name gastrosmart-backend
    cd /d "%~dp0"
) else (
    pm2 restart gastrosmart-backend >nul 2>&1
)

timeout /t 2 /nobreak >nul

:: Tarayıcıyı aç
start "" "http://localhost:3001"

echo.
echo  ════════════════════════════════════════════════
echo   Sistem Calisiyor!
echo.
echo   Adres   : http://localhost:3001
echo   Admin   : admin / admin123
echo.
echo   Tablet  : http://[bilgisayar-ip]:3001
echo   IP bul  : ipconfig komutu ile
echo.
echo   Log     : pm2 logs gastrosmart-backend
echo   Durdur  : DURDUR.bat
echo  ════════════════════════════════════════════════
echo.
pause
