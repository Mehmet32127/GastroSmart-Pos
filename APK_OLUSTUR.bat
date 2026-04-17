@echo off
chcp 65001 > nul
title GastroSmart APK Olusturucu

echo.
echo  GastroSmart POS - Android APK Olusturuluyor
echo  ============================================
echo.

set "ROOT=%~dp0"
set "FRONTEND=%ROOT%frontend"
set "ANDROID=%ROOT%frontend\android"
set "APK_SRC=%ROOT%frontend\android\app\build\outputs\apk\debug\app-debug.apk"
set "APK_DST=%ROOT%YUKLEYICILER\GastroSmart-POS.apk"

where java >nul 2>&1
if %errorlevel% neq 0 (
    echo  HATA: Java bulunamadi!
    echo  JDK 17 veya 21 kurun: https://adoptium.net
    pause
    exit /b 1
)

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  HATA: Node.js bulunamadi! https://nodejs.org
    pause
    exit /b 1
)

echo  [1/4] Launcher kontrol...
if not exist "%FRONTEND%\launcher\index.html" (
    echo  HATA: launcher\index.html bulunamadi!
    pause
    exit /b 1
)

echo  [2/4] Capacitor Android sync...
cd /d "%FRONTEND%"
if not exist "android" (
    echo  Android projesi olusturuluyor...
    call npx cap add android
    if %errorlevel% neq 0 (
        echo  HATA: cap add android basarisiz
        pause
        exit /b 1
    )
)
call npx cap copy android
if %errorlevel% neq 0 (
    echo  HATA: cap copy android basarisiz
    pause
    exit /b 1
)

echo  [3/4] Gradle build (debug)...
cd /d "%ANDROID%"
call gradlew.bat assembleDebug
if %errorlevel% neq 0 (
    echo  HATA: Gradle build basarisiz!
    echo  Kontrol: java -version  (JDK 17/21 gerekli)
    pause
    exit /b 1
)

echo  [4/4] APK kopyalaniyor...
if not exist "%~dp0YUKLEYICILER" mkdir "%~dp0YUKLEYICILER"
echo  Kaynak: %~dp0frontend\android\app\build\outputs\apk\debug\app-debug.apk
echo  Hedef : %~dp0YUKLEYICILER\GastroSmart-POS.apk
copy /Y "%~dp0frontend\android\app\build\outputs\apk\debug\app-debug.apk" "%~dp0YUKLEYICILER\GastroSmart-POS.apk"
if %errorlevel% neq 0 (
    echo  HATA: APK kopyalanamadi! Errorlevel: %errorlevel%
    pause
    exit /b 1
)

echo.
echo  ============================================
echo   BASARILI!
echo   APK: YUKLEYICILER\GastroSmart-POS.apk
echo.
echo   Tablette kurmak icin APK dosyasini acin.
echo   (Bilinmeyen Kaynaklar iznine ihtiyac var)
echo  ============================================
echo.
pause
