@echo off
chcp 65001 > nul
setlocal

:: ───────────────────────────────────────────────────────────────────
::  GastroSmart POS — Acil Durum Admin Şifre Sıfırlama
::
::  Admin şifresini unuttuğunuzda Başlat menüsünden
::  "Admin Şifre Sıfırla" kısayoluna TIKLAYIN.
::  Admin şifresi otomatik olarak "admin123" yapılır.
:: ───────────────────────────────────────────────────────────────────

title GastroSmart POS - Admin Sifre Sifirlama

:: Bu dosyanın bulunduğu klasör (kurulum kök dizini)
set "INSTALL_DIR=%~dp0"
if "%INSTALL_DIR:~-1%"=="\" set "INSTALL_DIR=%INSTALL_DIR:~0,-1%"

set "EXE=%INSTALL_DIR%\GastroSmart POS.exe"
set "BACKEND=%INSTALL_DIR%\resources\backend"
set "SCRIPT=%BACKEND%\scripts\reset-admin.js"

echo.
echo ═══════════════════════════════════════════════════════════
echo   GastroSmart POS — Admin Şifre Sıfırlama
echo ═══════════════════════════════════════════════════════════
echo.
echo  Bu araç admin şifresini "admin123" olarak sıfırlar.
echo.
echo  UYARI: Bu işlemi yapmadan önce GastroSmart POS uygulaması
echo         AÇIK olmalı (MongoDB'nin çalışması için).
echo.
echo ═══════════════════════════════════════════════════════════
echo.

set /p onay="Devam etmek icin ENTER, iptal icin CTRL+C: "

if not exist "%EXE%" (
    echo.
    echo [HATA] GastroSmart POS bulunamadı:
    echo        %EXE%
    echo.
    pause
    exit /b 1
)

if not exist "%SCRIPT%" (
    echo.
    echo [HATA] Sifirlama scripti bulunamadı:
    echo        %SCRIPT%
    echo.
    pause
    exit /b 1
)

echo.
echo Sifirlama başlatılıyor...
echo.

set ELECTRON_RUN_AS_NODE=1
pushd "%BACKEND%"
"%EXE%" "%SCRIPT%" admin123
popd

echo.
pause
