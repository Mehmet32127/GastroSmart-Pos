@echo off
chcp 65001 > nul
title GastroSmart APK Oluşturucu

echo.
echo  GastroSmart POS - Android APK Oluşturuluyor
echo  ════════════════════════════════════════════
echo.

set "ROOT=%~dp0"

:: Java kontrolü (Gradle için zorunlu)
where java >nul 2>&1
if %errorlevel% neq 0 (
    echo  HATA: Java bulunamadı!
    echo  JDK 17 veya 21 kurun: https://adoptium.net
    pause
    exit /b 1
)

:: Node.js kontrolü
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  HATA: Node.js bulunamadı! https://nodejs.org
    pause
    exit /b 1
)

echo  [1/4] Launcher kontrol...
pushd "%ROOT%frontend"
if not exist "launcher\index.html" (
    popd
    echo  HATA: launcher/index.html bulunamadı!
    echo  Launcher sayfasının mevcut olduğundan emin olun.
    pause
    exit /b 1
)

echo  [2/4] Capacitor Android sync...
:: android klasörü yoksa ekle, varsa sadece kopyala
if not exist "android" (
    echo  Android projesi oluşturuluyor...
    call npx cap add android
    if %errorlevel% neq 0 ( popd & echo  HATA: cap add android & pause & exit /b 1 )
)
call npx cap copy android
if %errorlevel% neq 0 ( popd & echo  HATA: cap copy android & pause & exit /b 1 )

echo  [3/4] Gradle build (debug)...
pushd android
call gradlew.bat assembleDebug
if %errorlevel% neq 0 (
    popd & popd
    echo  HATA: Gradle build başarısız!
    echo  Kontrol: java -version   ^(JDK 17/21 gerekli^)
    pause
    exit /b 1
)
popd

echo  [4/4] APK kopyalanıyor...
if not exist "%ROOT%YUKLEYICILER" mkdir "%ROOT%YUKLEYICILER"
set "APK_SRC=android\app\build\outputs\apk\debug\app-debug.apk"
set "APK_DST=%ROOT%YUKLEYICILER\GastroSmart-POS.apk"
copy /Y "%APK_SRC%" "%APK_DST%" >nul
if %errorlevel% neq 0 ( popd & echo  HATA: APK kopyalanamadı! & pause & exit /b 1 )
popd

echo.
echo  ════════════════════════════════════════════════
echo   BAŞARILI!
echo   APK: YUKLEYICILER\GastroSmart-POS.apk
echo.
echo   Tablette kurmak için:
echo   APK dosyasını tablette açın (Bilinmeyen Kaynaklar
echo   iznini etkinleştirmeniz gerekebilir).
echo  ════════════════════════════════════════════════
echo.
pause
