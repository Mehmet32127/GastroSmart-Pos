# GastroSmart POS — Proje Özeti

## Deployment Modeli
- Model B: Lokal LAN kurulum, tek restoran
- HTTP kullanılıyor (HTTPS yok — LAN ortamı, gerek yok)
- PM2 ile backend yönetimi (`ecosystem.config.js` → `pm2 start ecosystem.config.js --env production`)

## Klasör Yapısı
- Backend:  `backend/` — Node.js + Express + MongoDB
- Frontend: `frontend/` — React + Vite (build → `backend/public/`)
- Electron: `electron/` — Masaüstü uygulaması (MongoDB + backend gömülü)

## Çalıştırma (Geliştirme)
```
BASLAT.bat
# veya manuel: pm2 start ecosystem.config.js --env production
```

## Deploy (Üretim — frontend değişince)
```
cd frontend && npm run build
xcopy /s /e /y dist ..\backend\public\
pm2 restart gastrosmart-backend
```

## Electron Installer Build
```
EXE_OLUSTUR.bat   # → YUKLEYICILER\GastroSmart-POS-Setup.exe
# veya: npm run build:win (root'tan)
```

## Android APK
```
APK_OLUSTUR.bat     # Capacitor + Gradle (JDK 17/21 gerekli)
# APK: YUKLEYICILER\GastroSmart-POS.apk
# Tablet IP: frontend/capacitor.config.ts → server.url
```

## Önemli Notlar
- Frontend her zaman `backend/public/` klasörüne deploy edilmeli
- `ecosystem.config.js` → `script: './server.js'` + `cwd: './backend'` (ikisi birlikte doğru path'i verir)
- Electron `userData/secrets.json` — JWT/HMAC secretları restart'ta değişmez
- SMTP ayarları `backend/.env` içinde (Şifremi Unuttum özelliği için)
- Timezone: tüm tarihler Europe/Istanbul olarak gösterilir (Intl.DateTimeFormat)
- HMAC_SECRET: `frontend/.env.local` ve `backend/.env` içinde aynı değer olmalı
