# GastroSmart POS — Teknik Rapor

**Versiyon**: 1.0.0  
**Güncelleme**: Nisan 2026  
**Deployment**: Lokal LAN (Model B)

---

## Sistem Mimarisi

GastroSmart POS, tek bir Windows bilgisayar üzerinde çalışan, aynı ağdaki tüm cihazların tarayıcı üzerinden erişebildiği bir restoran adisyon sistemidir. İnternet bağlantısı gerektirmez.

```
[Tablet / Telefon / PC / Android APK]
         Chrome / Uygulama
              |
              | HTTP (LAN)
              |
    [Windows Server — Port 3001]
         Node.js / Express
         ├── /api/*      → REST API
         ├── /           → React (SPA build)
         └── Socket.io   → Gerçek zamanlı sync
              |
         MongoDB (Port 27017)
```

---

## Bileşenler

| Bileşen | Teknoloji | Konum |
|---------|-----------|-------|
| Backend | Node.js + Express | `backend/server.js` |
| Frontend | React + Vite (build) | `backend/public/` |
| Veritabanı | MongoDB | Windows Service |
| Process Manager | PM2 | `ecosystem.config.js` |
| Gerçek Zamanlı | Socket.io | Backend üzerinde |
| Masaüstü Uygulama | Electron 31 | `electron/main.js` |
| Android APK | Capacitor | `frontend/android/` |

---

## Teknoloji Stack

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Express 4
- **Veritabanı**: MongoDB (Mongoose ODM)
- **Kimlik Doğrulama**: JWT (access 15dk + refresh 7 gün)
- **Gerçek Zamanlı**: Socket.io
- **E-posta**: Nodemailer (SMTP — şifremi unuttum)
- **Excel Export**: ExcelJS
- **Güvenlik**: bcrypt, rate-limit, CORS, HMAC offline queue

### Frontend
- **Framework**: React 18 + TypeScript
- **Build**: Vite 5
- **Stil**: Tailwind CSS + CSS Variables (tema sistemi)
- **State**: Zustand
- **Form**: React Hook Form + Zod
- **Grafik**: Recharts
- **PWA**: Vite PWA Plugin (offline destek)

### Masaüstü (Electron)
- **Electron**: 31 (Node.js 20 gömülü)
- **MongoDB**: Portable binary (`electron/mongodb/mongod.exe`)
- **IPC**: Preload + contextBridge (yazıcı API)
- **Secretlar**: `userData/secrets.json` (restart'ta değişmez)

---

## Özellik Listesi

### Temel
- Masa yönetimi (açma/kapama/birleştirme/transfer)
- Sipariş alma ve takibi
- Menü ve kategori yönetimi
- Stok takibi

### Ödeme
- Nakit / Kart / Karma / İkram
- Para üstü hesaplama
- Kasa kapanış raporu

### Raporlar & Export
- Günlük/haftalık/aylık satış grafikleri
- Garson performansı
- Kategori bazlı satış analizi
- Excel export (Günlük 3 sayfa, Haftalık, Garsonlar, Stok) — tam biçimlendirilmiş

### Kullanıcı Yönetimi
- Roller: Admin, Müdür, Garson
- Şifre değiştirme
- Şifremi Unuttum (e-posta ile sıfırlama)

### Yazıcı Desteği
- Tarayıcı: OS print dialog (80mm/58mm termal)
- Electron: Sessiz yazdırma (dialog yok), yazıcı seçimi

### Ayarlar
- Logo yükleme/değiştirme
- Restoran adı, adres, telefon, vergi no
- Fiş alt notu
- Tema özelleştirme (renk, preset, köşe yuvarlama)
- Yazıcı kağıt boyutu (58mm / 80mm)

### Diğer
- Rezervasyon yönetimi
- Offline kuyruk (LAN kopunca işlem kaybolmaz, HMAC doğrulamalı)
- Bildirim sistemi
- Sipariş geçmişi

---

## Kurulum

### Gereksinimler
- Windows 10/11 (64-bit)
- Node.js 20 LTS
- MongoDB Community (Windows Service olarak kurulu)
- PM2: `npm install -g pm2`

### İlk Kurulum
```bat
cd D:\gastrosmart-pos\backend
npm install
node scripts/seed-mongodb.js

cd D:\gastrosmart-pos\frontend
npm install
npm run build
xcopy /s /e /y dist ..\backend\public\
```

### Başlatma
```bat
BASLAT.bat
:: Tarayıcı: http://localhost:3001
:: Tablet:   http://[sunucu-ip]:3001
```

### PM2 ile manuel başlatma
```bat
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup   :: Windows servis olarak kayıt
```

### Electron Installer Build
```bat
EXE_OLUSTUR.bat
:: → YUKLEYICILER\GastroSmart-POS-Setup.exe (~104 MB)
```

### Android APK Build
```bat
APK_OLUSTUR.bat
:: Gereksinim: JDK 17/21, Android SDK
:: → YUKLEYICILER\GastroSmart-POS.apk
```

---

## Varsayılan Giriş

| Alan | Değer |
|------|-------|
| Kullanıcı | `admin` |
| Şifre | `admin123` |

> ⚠️ **İlk girişte şifreyi mutlaka değiştirin!**

---

## Dosya Yapısı

```
gastrosmart-pos/
├── backend/
│   ├── server.js              Ana sunucu
│   ├── .env                   Ortam değişkenleri (SMTP, JWT, HMAC vb.)
│   ├── .env.example           Örnek ortam değişkenleri
│   ├── public/                Frontend build (deploy sonrası buraya gelir)
│   ├── uploads/               Logo ve görseller
│   ├── src/
│   │   ├── routes/            API endpoint'leri
│   │   ├── models/            MongoDB şemaları
│   │   ├── middleware/        Auth, hata yakalama
│   │   └── utils/             Yardımcı fonksiyonlar
│   └── scripts/
│       └── seed-mongodb.js    İlk kurulum seed
├── frontend/
│   ├── src/
│   │   ├── pages/             Sayfa bileşenleri
│   │   ├── components/        UI bileşenleri
│   │   ├── api/               Backend API istemcileri
│   │   ├── store/             Zustand state
│   │   └── utils/             format.ts, cn vb.
│   ├── .env.local             HMAC_SECRET (backend ile eşleşmeli)
│   └── android/               Capacitor Android projesi
├── electron/
│   ├── main.js                Ana process (MongoDB + backend yönetimi)
│   ├── preload.js             Renderer'a yazıcı API köprüsü
│   └── loading.html           Açılış splash ekranı
├── YUKLEYICILER/              Build çıktıları (APK, EXE) — git'e eklenmez
├── ecosystem.config.js        PM2 yapılandırması
├── package.json               Electron builder yapılandırması
├── BASLAT.bat                 PM2 ile sistemi başlat
├── DURDUR.bat                 Sistemi durdur
├── APK_OLUSTUR.bat            Android APK derle (Capacitor + Gradle)
└── EXE_OLUSTUR.bat            Windows EXE derle (Electron Builder)
```

---

## E-posta (Şifremi Unuttum)

`backend/.env` dosyasında SMTP ayarlarını doldurun:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=sizin@gmail.com
SMTP_PASS=uygulama-sifresi
SMTP_FROM=GastroSmart POS <noreply@gastrosmart.local>
```

Gmail App Password: Google Hesabım → Güvenlik → 2 Adımlı Doğrulama → Uygulama Şifreleri

---

## Önemli Notlar

- Tüm tarihler `Europe/Istanbul` timezone ile gösterilir (`Intl.DateTimeFormat`)
- Offline HMAC: `frontend/.env.local` ve `backend/.env` içindeki `HMAC_SECRET` aynı olmalı
- Electron secretlar: `%APPDATA%\GastroSmart POS\secrets.json` — restart'ta korunur
- PM2 log: `pm2 logs gastrosmart-backend` veya `backend/logs/` klasörü
