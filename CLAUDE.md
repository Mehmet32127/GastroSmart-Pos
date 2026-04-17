# GastroSmart POS — Proje Özeti

## Deployment Modeli
- Lokal LAN kurulum, tek restoran
- HTTP kullanılıyor (HTTPS yok — LAN ortamı, gerek yok)
- **Birincil dağıtım**: Electron tek tıkla EXE (`EXE_OLUSTUR.bat`) — MongoDB + backend gömülü, ek servis gerekmez
- **Opsiyonel saf sunucu modu**: PM2 + ayrı MongoDB (`ecosystem.config.js`) — yalnızca Electron kullanılmadığı durum için referans

## Klasör Yapısı
- Backend:  `backend/` — Node.js + Express + MongoDB
- Frontend: `frontend/` — React + Vite (build → `backend/public/`)
- Electron: `electron/` — Masaüstü uygulaması (MongoDB + backend gömülü)

## Çalıştırma
```
EXE_OLUSTUR.bat   # → YUKLEYICILER\GastroSmart-POS-Setup.exe  (Windows Electron)
APK_OLUSTUR.bat   # → YUKLEYICILER\GastroSmart-POS.apk        (Android)
```

## Frontend Değişince (kaynak koddan build)
```
cd frontend && npm run build
# sonra EXE_OLUSTUR.bat veya APK_OLUSTUR.bat çalıştır
```

## Önemli Notlar
- Electron içinde MongoDB + backend gömülü — ayrıca PM2/sunucu gerekmez
- Electron `userData/secrets.json` — JWT/HMAC secretları restart'ta değişmez
- Timezone: tüm tarihler Europe/Istanbul olarak gösterilir (Intl.DateTimeFormat)
- HMAC_SECRET: `frontend/.env.local` ve `backend/.env` içinde aynı değer olmalı
