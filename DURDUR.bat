@echo off
chcp 65001 > nul
title GastroSmart POS - Durdur

echo.
echo  GastroSmart POS durduruluyor...

pm2 stop gastrosmart-backend >nul 2>&1
if %errorlevel% equ 0 (
    echo  Backend durduruldu.
) else (
    echo  Backend zaten çalışmıyor veya bulunamadı.
)

echo.
echo  Tamamen kaldırmak için: pm2 delete gastrosmart-backend
echo  Tekrar başlatmak için : BASLAT.bat
echo.
pause
