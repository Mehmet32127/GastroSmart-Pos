# Sürüm Notları

Tüm dikkate değer değişiklikler bu dosyada listelenir. Format
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) standardına yakın,
sürüm numaralandırma [Semantic Versioning](https://semver.org/) prensiplerine
göre.

## [1.1.0] - 2026-05-10

### Eklendi
- **Multi-tenant mimari**: Her restoran kendi MongoDB veritabanında izole
- **Süper-admin paneli** (`/admin/login`, `/admin/dashboard`): yeni restoran
  açma, listeleme, pasifleştirme, şifre sıfırlama
- **Auto-discover login**: kullanıcı sadece kullanıcı adı + şifre yazar,
  sistem hangi restorana ait olduğunu otomatik bulur
- **Rezervasyon kodu**: kişisel veri yerine 6 haneli benzersiz kod (Burger
  King mantığı). `EF7K2N` gibi
- **Stok Sayım modal'ı**: tüm ürünlerin stoğunu tek ekrandan toplu güncelleme
- **"Hesabım"** kartı: kullanıcı kendi adı/email/telefon/kullanıcı adı bilgilerini
  Settings sayfasından düzenleyebilir
- **Yeni tenant seed**: 4 default kategori (Yiyecekler/İçecekler/Tatlılar/Sıcak)
  + 4 örnek masa otomatik gelir
- **Audit log**: login, sipariş kapama gibi olaylar 90 gün TTL ile kayıt
- **Sentry**: backend ve frontend error tracking (DSN env'iyle aktif)
- **`/api/ping`**: UptimeRobot için hafif endpoint
- **Sıkı rate limit**: login 5/15dk, super-admin 3/15dk, forgot-password 3/saat
- **Boot validation**: sayfa açılışında token backend'e doğrulanır,
  expired ise otomatik logout
- **PWA prompt mode**: form doldururken otomatik refresh atmıyor
- **k6 yük testi script'i** + jest unit testler (13 test)

### Düzeltildi
- **Login bug** (kritik): tenant kullanıcıları çift hash + schema cache çakışması
  yüzünden giriş yapamıyordu
- **Şifre sıfırlama bug** (kritik): yeni şifre eskinin yerine geçmiyordu
  (forgot-password legacy DB'de aranıyordu)
- **Socket.IO multi-tenant**: tenant kullanıcıları socket'e bağlanamıyordu
- **Çift "Tümü" buton**: boş tenant'ta TablesPage'de iki "Tümü" görünüyordu
- **Sidebar collapse oku** çok küçüktü ("Q" gibi görünüyordu) → 16px belirgin
- **Düzenle modal'ında stok 0 default**: sınırsız ürünleri yanlışlıkla 0'a düşürüyordu
- **PWA autoUpdate** form doldururken sayfa refresh ediyordu
- **Reservation PII**: müşteri adı/telefon/email tamamen kaldırıldı (KVKK)
- **Termal yazıcı kağıt boyutu** hardcoded 80mm → query param ile dinamik

### Güvenlik
- 2FA aktif (sahip hesaplarında): GitHub, Render, Atlas, Brevo, Gmail
- Helmet header'ları sıkılaştırıldı (HSTS preload, frameguard deny)
- Şifreler bcrypt 12 round
- Refresh token formatı `slug.hex` ile tenant izolasyonu
- Audit logging: kim ne yaptı, 90 gün

## [1.0.0] - 2026-04-15

### İlk sürüm
- Tek-restoran POS sistemi
- Masa, sipariş, menü, rezervasyon, raporlar
- Electron masaüstü + web demo
- Lokal LAN modu
