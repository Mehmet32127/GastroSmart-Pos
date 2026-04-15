@echo off
chcp 65001 > nul
title GastroSmart EXE Oluşturucu

echo.
echo  GastroSmart POS - Windows EXE Oluşturuluyor
echo  ════════════════════════════════════════════
echo.

set "ROOT=%~dp0"

:: Node.js kontrolü
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  HATA: Node.js bulunamadı! https://nodejs.org
    pause
    exit /b 1
)

pushd "%ROOT%"

:: Root bağımlılıklar (Electron builder)
if not exist "node_modules" (
    echo  [0/5] Root bağımlılıklar kuruluyor...
    call npm install --silent
    if %errorlevel% neq 0 ( popd & echo  HATA: npm install (root) & pause & exit /b 1 )
)

echo  [1/5] Backend bağımlılıklar...
pushd backend
if not exist "node_modules" (
    call npm install --silent
    if %errorlevel% neq 0 ( popd & popd & echo  HATA: npm install (backend) & pause & exit /b 1 )
)
popd

echo  [2/5] Frontend bağımlılıklar...
pushd frontend
if not exist "node_modules" (
    call npm install --silent
    if %errorlevel% neq 0 ( popd & popd & echo  HATA: npm install (frontend) & pause & exit /b 1 )
)
popd

echo  [3/5] React derleniyor...
pushd frontend
call npm run build
if %errorlevel% neq 0 ( popd & popd & echo  HATA: Frontend build başarısız & pause & exit /b 1 )
popd

echo  [4/5] Public klasörüne kopyalanıyor...
if not exist "backend\public" mkdir "backend\public"
xcopy /s /e /y /q "frontend\dist\*" "backend\public\"

echo  [5/5] EXE paketi oluşturuluyor...
call npm run build:win
if %errorlevel% neq 0 ( popd & echo  HATA: electron-builder başarısız & pause & exit /b 1 )

if not exist "YUKLEYICILER" mkdir "YUKLEYICILER"
for %%f in ("dist-electron\GastroSmart POS Setup *.exe") do (
    copy /Y "%%f" "YUKLEYICILER\GastroSmart-POS-Setup.exe" >nul
    echo  Kopyalandı: %%~nxf
)
popd

echo.
echo  ════════════════════════════════════════════════
echo   BAŞARILI!
echo   EXE: YUKLEYICILER\GastroSmart-POS-Setup.exe
echo.
echo   Bu kurulum paketi MongoDB ve backend dahil
echo   tam bir bağımsız Windows uygulamasıdır.
echo  ════════════════════════════════════════════════
echo.
pause
