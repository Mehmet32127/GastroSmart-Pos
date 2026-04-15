@echo off
chcp 65001 > nul
title GastroSmart APK Olusturucu

echo.
echo  GastroSmart POS - Android APK Olusturuluyor
echo  ============================================
echo.

set "ROOT=%~dp0"

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
pushd "%ROOT%frontend"
if not exist "launcher\index.html" (
    popd
    echo  HATA: launcher\index.html bulunamadi!
    pause
    exit /b 1
)

echo  [2/4] Capacitor Android sync...
if not exist "android" (
    echo  Android projesi olusturuluyor...
    call npx cap add android
    if %errorlevel% neq 0 (
        popd
        echo  HATA: cap add android basarisiz
        pause
        exit /b 1
    )
)
call npx cap copy android
if %errorlevel% neq 0 (
    popd
    echo  HATA: cap copy android basarisiz
    pause
    exit /b 1
)

echo  [3/4] Gradle build (debug)...
pushd android
call gradlew.bat assembleDebug
if %errorlevel% neq 0 (
    popd
    popd
    echo  HATA: Gradle build basarisiz!
    echo  Kontrol: java -version  (JDK 17/21 gerekli)
    pause
    exit /b 1
)
popd

echo  [4/4] APK kopyalaniyor...
if not exist "%ROOT%YUKLEYICILER" mkdir "%ROOT%YUKLEYICILER"
set "APK_SRC=android\app\build\outputs\apk\debug\app-debug.apk"
copy /Y "%APK_SRC%" "%ROOT%YUKLEYICILER\GastroSmart-POS.apk" >nul
if %errorlevel% neq 0 (
    popd
    echo  HATA: APK kopyalanamadi!
    pause
    exit /b 1
)
popd

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
