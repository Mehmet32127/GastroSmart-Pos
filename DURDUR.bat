@echo off
chcp 65001 > nul
title GastroSmart POS - Durdur

echo  GastroSmart durduruluyor...
pm2 stop gastrosmart-backend >nul 2>&1
echo  Durduruldu.
timeout /t 2 /nobreak >nul
