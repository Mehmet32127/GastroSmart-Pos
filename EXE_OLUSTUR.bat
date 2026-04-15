@echo off
chcp 65001 > nul
title GastroSmart EXE

echo.
echo  GastroSmart POS - Windows EXE Olusturuluyor
echo.

set "ROOT=%~dp0"

where node 1>nul 2>nul
if %errorlevel% neq 0 (
  echo  HATA: Node.js bulunamadi! nodejs.org
  pause & exit /b 1
)

pushd "%ROOT%"
if not exist "node_modules" (
  echo  [0/5] Root bagimliliklar kuruluyor...
  call npm install --silent
  if %errorlevel% neq 0 ( popd & echo HATA: npm install & pause & exit /b 1 )
)

echo  [1/5] Backend bagimliliklar...
pushd backend
if not exist "node_modules" call npm install --silent
popd

echo  [2/5] Frontend bagimliliklar...
pushd frontend
if not exist "node_modules" call npm install --silent
popd

echo  [3/5] React derleniyor...
pushd frontend
call npm run build
if %errorlevel% neq 0 ( popd & popd & echo HATA: build & pause & exit /b 1 )
popd

echo  [4/5] Public klasore kopyalanıyor...
if not exist "backend\public" mkdir "backend\public"
xcopy /s /e /y /q "frontend\dist\*" "backend\public\"

echo  [5/5] EXE paketi olusturuluyor...
call npm run build:win
if %errorlevel% neq 0 ( popd & echo HATA: electron-builder & pause & exit /b 1 )

if not exist "YUKLEYICILER" mkdir "YUKLEYICILER"
for %%f in ("dist-electron\GastroSmart POS Setup *.exe") do (
  copy /Y "%%f" "YUKLEYICILER\GastroSmart-POS-Setup.exe" 1>nul
  echo  Kopyalandi: %%~nxf
)
popd

echo.
echo  BASARILI: YUKLEYICILER\GastroSmart-POS-Setup.exe
echo.
pause
