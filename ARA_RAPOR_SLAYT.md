# GastroSmart POS — Ara Rapor Slayt İçerikleri
# Bu dosyayı bir PPTX dönüştürücüye yapıştırabilirsiniz.

---

## SLAYT 1 — KAPAK

**GastroSmart POS**
*Restoran Yönetim ve Satış Noktası Sistemi*

Ara Teknik Rapor
Nisan 2026

---

## SLAYT 2 — PROJE TANIMI

**Proje Adı:** GastroSmart POS

**Amaç:** Restoran işletmelerinde masa yönetimi, sipariş takibi, ödeme ve raporlamayı dijital ortama taşıyan, internet bağımsız çalışan bir satış noktası (POS) sistemi geliştirmek.

**Kapsam:**
- Masaüstü uygulama (Windows EXE)
- Web arayüzü (LAN üzerinden tüm cihazlar)
- Android tablet uygulaması (APK)
- Termal yazıcı entegrasyonu

---

## SLAYT 3 — PROBLEM VE ÇÖZÜM

**Mevcut Sorunlar:**
- Kağıt tabanlı sipariş takibi: hata riski yüksek
- İnternet kesintisinde sistemin durması
- Yüksek lisans maliyetli ticari POS yazılımları
- Tablet ile PC arasında manuel veri aktarımı ihtiyacı

**GastroSmart Çözümü:**
- LAN (yerel ağ) üzerinden çalışır → internet gerekmez
- Offline kuyruk: bağlantı kopsa bile işlem kaybolmaz
- Açık kaynak teknoloji yığını, sıfır lisans maliyeti
- Gerçek zamanlı senkronizasyon (Socket.io) ile tüm cihazlar anlık güncellenir

---

## SLAYT 4 — SİSTEM MİMARİSİ

```
[ Garson Tableti ]  [ Kasiyer PC ]  [ Android APK ]
        |                  |               |
        +------------------+---------------+
                           |
                   HTTP (LAN — Port 3001)
                           |
              ┌────────────────────────┐
              │   Windows Server PC    │
              │   Node.js + Express    │
              │   ├── REST API /api/*  │
              │   ├── Socket.io (RT)   │
              │   └── React SPA build  │
              │         │              │
              │     MongoDB :27017     │
              └────────────────────────┘
```

**Deployment Modeli:** Tek sunucu, çoklu istemci (Model B — Lokal LAN)

---

## SLAYT 5 — TEKNOLOJİ YIĞINI

| Katman | Teknoloji | Versiyon |
|--------|-----------|----------|
| Backend | Node.js + Express | 20 LTS / 4.x |
| Veritabanı | MongoDB + Mongoose | 8.x |
| Frontend | React + TypeScript | 18 / 5 |
| Build | Vite | 5.x |
| Stil | Tailwind CSS | 3.x |
| State Yönetimi | Zustand | 4.x |
| Gerçek Zamanlı | Socket.io | 4.7 |
| Masaüstü | Electron | 31 |
| Mobil | Capacitor | 6.x |
| Excel Export | ExcelJS | 4.x |
| Grafik | Recharts | 2.x |
| Güvenlik | bcrypt + JWT + HMAC | — |

---

## SLAYT 6 — VERİTABANI TASARIMI

**MongoDB Koleksiyonları:**

| Koleksiyon | Açıklama | Anahtar Alanlar |
|---|---|---|
| users | Personel kayıtları | username, role, password_hash |
| tables | Masa bilgileri | number, status, section |
| orders | Siparişler | items[], payment_method, total, closed_at |
| menu_items | Menü ürünleri | price, stock, tax, category_id |
| categories | Ürün kategorileri | name, icon, sort_order |
| settings | Sistem ayarları | key, value (anahtar-değer) |
| reservations | Rezervasyonlar | table_id, guest_name, date |
| refresh_tokens | JWT refresh | token, user_id, expires_at |
| cash_closes | Kasa kapanış | date, total, cash, card |

**İlişki Yapısı:** MongoDB döküman modeli — Order içinde items dizisi gömülü (embedded)

---

## SLAYT 7 — ANA MODÜLLER

**Masa Yönetimi**
- Masa açma / kapama
- Bölüm (section) gruplandırma
- Anlık durum: Boş / Dolu / Rezerveli / Temizleniyor

**Sipariş Modülü**
- Ürün ekleme/çıkarma/iptal
- Masa transferi
- Özel notlar

**Ödeme Modülü**
- Nakit / Kart / Karma / İkram
- Para üstü otomatik hesaplama
- Kısmi ödeme desteği

**Menü Yönetimi**
- Kategori ve ürün CRUD
- Stok takibi ve uyarıları
- Görsel yükleme

---

## SLAYT 8 — GÜVENLİK MİMARİSİ

**Kimlik Doğrulama:**
- JWT Access Token (15 dakika)
- Refresh Token (7 gün) — MongoDB'de saklanır
- bcrypt ile şifre hashleme (12 round)

**Yetkilendirme — 3 Katmanlı Rol Sistemi:**

| Rol | Yetkiler |
|---|---|
| Admin | Tüm yetkiler + kullanıcı yönetimi + sistem ayarları |
| Müdür | Sipariş, menü, raporlar, rezervasyon |
| Garson | Sadece masa ve sipariş işlemleri |

**Ek Güvenlik:**
- Rate limiting: Giriş denemesine özel (15 dk / 20 deneme)
- CORS kontrolü
- HMAC imzalı offline kuyruk (kuyruk manipülasyonu engeli)
- Helmet.js (HTTP başlık güvenliği)

---

## SLAYT 9 — GERÇEK ZAMANLI İLETİŞİM

**Socket.io Olay Mimarisi:**

```
Sunucu → Tüm Bağlı İstemciler
  order:created   → Yeni sipariş açıldı
  order:updated   → Sipariş güncellendi
  order:closed    → Masa kapandı
  table:updated   → Masa durumu değişti
  menu:updated    → Menü değişikliği
  settings:sync   → Tema / ayar güncellemesi
```

**Sonuç:** Garson A tablette sipariş verdiğinde, kasiyer PC'sinde anında görünür. Masa doluluk durumu her cihazda eş zamanlı güncellenir.

---

## SLAYT 10 — RAPORLAMA SİSTEMİ

**Ekran Üzerinde Grafikler (Recharts):**
- Günlük ciro (anlık)
- Saatlik yoğunluk grafiği
- Haftalık satış trendi
- Kategori bazlı pasta grafik
- Garson performans tablosu

**Excel Export (ExcelJS — Tam Biçimli):**

| Rapor | Sayfalar |
|---|---|
| Günlük | Özet, Siparişler, Ürün Detayı |
| Haftalık | Günlük Özet + Toplamlar |
| Garsonlar | Sipariş, Ciro, Kart/Nakit, Ort. Süre |
| Stok | Tüm ürünler, Kırmızı=Tükendi, Sarı=Düşük |

- Timezone: `Europe/Istanbul` (Tüm tarih/saat gösterimleri)

---

## SLAYT 11 — ANDROID APK (OTOMATİK BAĞLANTI)

**Problem:** Kullanıcı sunucu IP adresini bilmiyor.

**Çözüm — Akıllı Launcher:**

```
APK başlar
    ↓
localStorage'da kayıtlı URL var mı?
    ↓ Evet → /api/health ile test et
    ↓ Hayır
    ↓
WebRTC ile yerel ağ subnet'i tespit et
(192.168.1.x gibi)
    ↓
1-254 arası paralel tarama (20'şer batch)
Her IP: /api/health → app === 'gastrosmart-pos' ?
    ↓ Bulundu
Yönlendir → http://[sunucu-ip]:3001
```

**Sonuç:** Kullanıcı IP bilmeden, APK kurulduktan sonra otomatik bağlanır.

**Teknoloji:** Capacitor 6, WebRTC, fetch + AbortController (700ms timeout)

---

## SLAYT 12 — MASAÜSTÜ UYGULAMA (ELECTRON)

**Özellikler:**
- Tek tıkla kurulum (EXE installer, ~104 MB)
- Gömülü MongoDB — ayrı kurulum gerekmez
- Gömülü Node.js backend — ayrı kurulum gerekmez
- Sistem tepsisinde çalışır (X tuşu kapatmaz, arka planda devam eder)
- Otomatik splash ekranı (backend hazır olana kadar)

**Yazıcı Entegrasyonu (IPC Mimarisi):**
```
React UI
  → window.electronAPI.printReceipt(html, printer, paperWidth)
  → [contextBridge / preload.js]
  → ipcRenderer.invoke('print:receipt')
  → [Electron main.js]
  → webContents.print({ silent: true })
  → USB Termal Yazıcı (dialog yok, direkt çıktı)
```

**Kağıt Boyutu Desteği:** 58mm ve 80mm termal yazıcılar

---

## SLAYT 13 — AYARLAR VE KİŞİSELLEŞTİRME

**Restoran Ayarları:**
- Logo yükleme / değiştirme (PNG, JPG, WebP, SVG — maks 5 MB)
- Restoran adı, adres, telefon, vergi numarası
- Fiş alt notu
- Para birimi (TRY, USD, EUR, GBP)

**Tema Sistemi:**
- CSS Variables tabanlı — dinamik tema değişimi, sayfa yenileme yok
- Hazır temalar: Dark, Light, Ocean, Sunset, Forest
- Özel renk editörü (accent, background, surface...)
- Gerçek zamanlı yayın: Bir cihazda tema değişince tüm cihazlar güncellenir

**Yazıcı Ayarları:**
- Kağıt boyutu: 58mm / 80mm
- Electron: Sistem yazıcısı seçimi (dropdown)

---

## SLAYT 14 — KURULUM VE DEPLOYMENT

**Gereksinimler:**
- Windows 10/11 (64-bit)
- Node.js 20 LTS
- MongoDB Community (Windows Service)
- PM2 (süreç yöneticisi)

**Kurulum Adımları:**
1. MongoDB kur → Windows Service olarak başlat
2. `npm install` (backend ve frontend)
3. `npm run build` → `backend/public/` klasörüne deploy
4. `pm2 start ecosystem.config.js --env production`
5. Tarayıcı: `http://localhost:3001`
6. Tablet: `http://[sunucu-ip]:3001`

**Paketleme:**
- Windows EXE: `npm run build:win` (electron-builder)
- Android APK: `APK_OLUSTUR.bat` (Capacitor + Gradle)

---

## SLAYT 15 — SONUÇ VE İLERİYE DÖNÜK PLANLAR

**Tamamlanan Özellikler (v1.0):**
✓ Tam işlevsel POS sistemi  
✓ Gerçek zamanlı çoklu cihaz desteği  
✓ Offline çalışma kabiliyeti  
✓ Android APK (otomatik sunucu keşif)  
✓ Windows EXE (gömülü veritabanı)  
✓ Termal yazıcı desteği  
✓ Detaylı Excel raporları  

**Planlanan Geliştirmeler:**
- Mutfak ekranı (KDS — Kitchen Display System)
- QR menü (masadan kendi siparişini oluşturma)
- Çoklu şube desteği
- Bulut yedekleme seçeneği
- iOS uygulama desteği

---

*GastroSmart POS — Nisan 2026*
