# GastroSmart POS — Teknik Rapor

**Versiyon**: 1.0.0  
**Güncelleme**: Nisan 2026  
**Deployment**: Lokal LAN (Model B)

---

## Sistem Mimarisi

GastroSmart POS, tek bir Windows bilgisayar üzerinde çalışan, aynı ağdaki tüm cihazların tarayıcı üzerinden erişebildiği bir restoran adisyon sistemidir. İnternet bağlantısı gerektirmez.

**Dağıtım modeli:** Birincil kurulum biçimi Electron tabanlı tek tıkla kurulabilen Windows EXE'dir (MongoDB + Node.js backend gömülüdür, ek servis gerekmez). Aynı ağdaki diğer cihazlar (tablet, telefon, Android APK) `http://SUNUCU-IP:3001` adresine bağlanır. PM2 + ayrı MongoDB servisi kullanımı opsiyonel saf LAN sunucu modudur; `ecosystem.config.js` bu durum için referans olarak tutulmuştur.

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
| Process Manager (opsiyonel, saf LAN modu) | PM2 | `ecosystem.config.js` |
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
- Masa yönetimi (ekleme/düzenleme/silme/açma/kapama/birleştirme/transfer)
- Sipariş alma ve takibi
- Menü ve kategori yönetimi (kategori silme dahil)
- Stok takibi

### Ödeme
- Nakit / Kart / Karma / İkram
- Para üstü hesaplama
- Kasa kapanış raporu

### Raporlar & Export
- Günlük / Haftalık / Aylık / Yıllık satış grafikleri
- Garson performansı
- Kategori bazlı satış analizi (pasta grafik, ürün detayı)
- Excel export (Günlük 3 sayfa, Haftalık, Garsonlar, Stok) — tam biçimlendirilmiş

### Kullanıcı Yönetimi
- Roller: Admin, Müdür, Garson
- Şifre değiştirme (giriş yapmış kullanıcı)
- Admin, Kullanıcılar sayfasından herhangi bir kullanıcının şifresini sıfırlayabilir

### Yazıcı Desteği
- Tarayıcı: OS print dialog (80mm/58mm termal)
- Electron: Sessiz yazdırma (dialog yok)

### Ayarlar
- Restoran adı, adres, telefon, vergi no
- Fiş alt notu
- Para birimi (TRY / USD / EUR / GBP) — tüm ekranları etkiler
- Tema özelleştirme (renk, preset, köşe yuvarlama)
- Yazıcı kağıt boyutu (58mm / 80mm)

### Diğer
- Rezervasyon yönetimi (filtre: Tümü / Onaylandı / Geçmiş)
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

### İlk Kurulum (son kullanıcı)
`YUKLEYICILER\GastroSmart-POS-Setup.exe` çalıştırılır. Başka bir şey gerekmez — MongoDB ve backend gömülüdür.

### Geliştirici Build (kaynak koddan)
```bat
cd D:\gastrosmart-pos\backend
npm install
npm run seed              :: İlk admin kullanıcı + örnek veri

cd D:\gastrosmart-pos\frontend
npm install
npm run build
xcopy /s /e /y dist ..\backend\public\
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
│   ├── .env                   Ortam değişkenleri (JWT, HMAC vb.)
│   ├── .env.example           Örnek ortam değişkenleri
│   ├── public/                Frontend build (deploy sonrası buraya gelir)
│   ├── uploads/               Kullanıcı yüklemeleri (logo vb.) — git'e eklenmez
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
├── ecosystem.config.js        PM2 yapılandırması (referans)
├── package.json               Electron builder yapılandırması
├── APK_OLUSTUR.bat            Android APK derle (Capacitor + Gradle)
└── EXE_OLUSTUR.bat            Windows EXE derle (Electron Builder)
```

---

## Şifre Sıfırlama

### Normal Kullanıcı (garson / müdür)
Şifresini unutan kullanıcı admin'e başvurur. Admin, **Kullanıcılar** sayfasından ilgili kullanıcının yanındaki "Şifre Sıfırla" butonuna basarak yeni bir şifre belirler.

### Admin Unutursa (Acil Durum Kurtarma)
GastroSmart POS kurulduğunda **Masaüstüne** ve **Başlat Menüsüne** otomatik olarak "GastroSmart - Admin Şifre Sıfırla" kısayolu eklenir.

Admin şifresini unutunca:
1. GastroSmart POS uygulamasını aç (MongoDB'nin çalışması için)
2. Masaüstünden veya Başlat Menüsünden **"GastroSmart - Admin Şifre Sıfırla"** kısayoluna çift tıkla
3. ENTER'a bas → admin şifresi `admin123` olarak sıfırlanır
4. Giriş yap, Ayarlar'dan mutlaka değiştir

> Güvenlik: Bu araç yalnızca sunucu bilgisayarında (MongoDB'nin kurulu olduğu makinede) çalışır. Fiziksel makine erişimi gerektirdiğinden güvenli bir kurtarma yoludur.

> **Not — Şifre görüntüleme neden yok?** Şifreler veritabanında `bcrypt` ile hash'lenmiş olarak saklanır ve matematiksel olarak geri çevrilemez. Admin dahil hiç kimse bir kullanıcının şifresini "görüntüleyemez" — yalnızca **sıfırlayabilir**. Bu sektör standardıdır (Google, banka sistemleri vb.) ve şifre sızıntısı riskini ortadan kaldırır.

---

## Önemli Notlar

- Tüm tarihler `Europe/Istanbul` timezone ile gösterilir (`Intl.DateTimeFormat`)
- Offline HMAC: `frontend/.env.local` ve `backend/.env` içindeki `HMAC_SECRET` aynı olmalı
- Electron secretlar: `%APPDATA%\GastroSmart POS\secrets.json` — restart'ta korunur
- PM2 log: `pm2 logs gastrosmart-backend` veya `backend/logs/` klasörü
