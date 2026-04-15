@echo off
chcp 65001 > nul
title GastroSmart APK

echo.
echo  GastroSmart POS - Android APK Olusturuluyor
echo.

set "ROOT=%~dp0"

echo  [1/4] Launcher kontrol...
pushd "%ROOT%frontend"
if not exist "launcher\index.html" (
  popd
  echo  HATA: launcher/index.html bulunamadi!
  pause
  exit /b 1
)

echo  [2/4] Android sync...
call npx cap add android 2>nul
call npx cap copy android
if %errorlevel% neq 0 ( popd & echo HATA: cap copy & pause & exit /b 1 )

echo  [3/4] Gradle build...
pushd android
call gradlew.bat assembleDebug
if %errorlevel% neq 0 (
  popd & popd
  echo  HATA: Gradle build basarisiz!
  echo  Kontrol: java -version
  pause
  exit /b 1
)
popd

echo  [4/4] APK kopyalaniyor...
if not exist "%ROOT%YUKLEYICILER" mkdir "%ROOT%YUKLEYICILER"
set "APK_FILE=android\app\build\outputs\apk\debug\app-debug.apk"
copy /Y "%APK_FILE%" "%ROOT%YUKLEYICILER\GastroSmart-POS.apk"
if %errorlevel% neq 0 ( popd & echo HATA: APK kopyalanamadi! & pause & exit /b 1 )
popd

echo.
echo  BASARILI: YUKLEYICILER\GastroSmart-POS.apk
echo.
pause
