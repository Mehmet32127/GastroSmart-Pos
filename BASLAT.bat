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
    echo  https://nodejs.org adresinden LTS sürümünü indirin.
    pause
    exit /b 1
)

:: PM2 kontrolü — yoksa yükle
where pm2 >nul 2>&1
if %errorlevel% neq 0 (
    echo  PM2 kuruluyor...
    call npm install -g pm2
    if %errorlevel% neq 0 (
        echo  HATA: PM2 kurulamadı!
        pause
        exit /b 1
    )
)

:: MongoDB servis kontrolü
sc query MongoDB | find "RUNNING" >nul 2>&1
if %errorlevel% neq 0 (
    echo  MongoDB başlatılıyor...
    net start MongoDB >nul 2>&1
    if %errorlevel% neq 0 (
        echo  UYARI: MongoDB servisi başlatılamadı.
        echo  MongoDB'nin Windows servisi olarak kurulu olduğundan emin olun.
    )
    timeout /t 2 /nobreak >nul
)

:: Backend bağımlılıkları
if not exist "%~dp0backend\node_modules" (
    echo  Backend kurulumu yapılıyor...
    pushd "%~dp0backend"
    call npm install --silent
    popd
)

:: PM2 ile backend başlat (ecosystem.config.js kullanarak)
pm2 describe gastrosmart-backend >nul 2>&1
if %errorlevel% neq 0 (
    echo  Backend başlatılıyor...
    pm2 start "%~dp0ecosystem.config.js" --env production
) else (
    pm2 restart gastrosmart-backend >nul 2>&1
)

timeout /t 2 /nobreak >nul

:: Sunucu IP adresini bul
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set "SERVER_IP=%%a"
    goto :found_ip
)
:found_ip
set "SERVER_IP=%SERVER_IP: =%"

:: Tarayıcıyı aç
start "" "http://localhost:3001"

echo.
echo  ════════════════════════════════════════════════
echo   Sistem Çalışıyor!
echo.
echo   Bu Bilgisayar  : http://localhost:3001
echo   Tablet / Telefon: http://%SERVER_IP%:3001
echo.
echo   Log izle  : pm2 logs gastrosmart-backend
echo   Durdur    : DURDUR.bat
echo  ════════════════════════════════════════════════
echo.
pause
