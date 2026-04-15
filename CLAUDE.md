# GastroSmart POS — Proje Özeti

## Deployment Modeli
- Model B: Lokal LAN kurulum, tek restoran
- HTTP kullanılıyor (HTTPS yok — LAN ortamı, gerek yok)
- PM2 ile backend yönetimi (Windows'ta MongoDB Service + PM2)

## Klasör Yapısı
- Backend:  `backend/` — Node.js + Express + MongoDB
- Frontend: `frontend/` — React + Vite (build → `backend/public/`)
- Electron: `electron/` — Masaüstü uygulaması (MongoDB + backend gömülü)

## Çalıştırma (Geliştirme)
```
BASLAT.bat
# veya: cd backend && pm2 start server.js --name gastrosmart-backend
```

## Deploy (Üretim — frontend değişince)
```
cd frontend && npm run build
cp -r dist ../backend/public
pm2 restart gastrosmart-backend
```

## Electron Installer Build
```
npm run build:win   # → dist-electron/GastroSmart POS Setup 1.0.0.exe
```

## Android APK
```
APK_OLUSTUR.bat     # Capacitor + Android Studio
# APK: frontend/android/app/build/outputs/apk/debug/app-debug.apk
# Tablet IP: frontend/capacitor.config.ts → server.url
```

## Önemli Notlar
- Frontend her zaman `backend/public/` klasörüne deploy edilmeli
- Electron `userData/secrets.json` — JWT/HMAC secretları restart'ta değişmez
- SMTP ayarları `backend/.env` içinde (Şifremi Unuttum özelliği için)
- Timezone: tüm tarihler Europe/Istanbul olarak gösterilir (Intl.DateTimeFormat)
