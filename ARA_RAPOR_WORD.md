# GastroSmart POS — Ara Teknik Rapor
# WORD DOSYASI İÇİN METİN
# (Times New Roman, 11 punto, iki yana yaslanmış)

---

**GastroSMART POS**
**Restoran Yönetim ve Satış Noktası Sistemi**
**Ara Teknik Rapor — Nisan 2026**

---

## 1. GİRİŞ VE PROJE TANIMI

GastroSmart POS, restoran işletmelerine yönelik geliştirilmiş, internet bağımsız çalışabilen yerel ağ tabanlı (LAN) bir satış noktası (Point of Sale) yönetim sistemidir. Sistem; masa yönetimi, sipariş takibi, ödeme işlemleri, stok kontrolü, personel yönetimi, rezervasyon takibi ve gelir raporlaması gibi bir restoranın temel ihtiyaçlarını tek bir platformda karşılamayı hedeflemektedir.

Günümüzde pek çok restoran, kağıt tabanlı sipariş yöntemleri veya yüksek lisans ücretleri gerektiren ticari POS yazılımları kullanmaktadır. Bu durum hem operasyonel hatalara zemin hazırlamakta hem de küçük ve orta ölçekli işletmeler için ciddi bir maliyet yükü oluşturmaktadır. GastroSmart POS; açık kaynak teknoloji yığını üzerine inşa edilmiş, sıfır ek lisans maliyetiyle çalışan, tek bir Windows bilgisayar üzerine kurulabilen ve aynı ağdaki tablet, telefon veya bilgisayarlardan eş zamanlı erişilebilen bir çözüm sunmaktadır.

---

## 2. SİSTEM MİMARİSİ

GastroSmart POS, istemci-sunucu mimarisine dayanan, yerel ağ (LAN) üzerinden çalışan bir web uygulamasıdır. Mimari iki ana katmandan oluşmaktadır:

**Sunucu Katmanı:** Windows işletim sistemi üzerinde çalışan Node.js tabanlı bir Express sunucusu. Sunucu; REST API uç noktaları, Socket.io gerçek zamanlı iletişim altyapısı ve React ile oluşturulmuş derleme çıktısını (build) barındırmaktadır. Veriler MongoDB veritabanında saklanmaktadır.

**İstemci Katmanı:** Aynı yerel ağa bağlı herhangi bir cihaz — Windows/Mac/Linux bilgisayar, Android veya iOS tablet/telefon — tarayıcı aracılığıyla sisteme erişebilir. Bunlara ek olarak, gömülü MongoDB ve Node.js ile birlikte gelen Windows kurulum paketi (EXE) ve Capacitor tabanlı Android APK da istemci seçenekleri arasında yer almaktadır.

Sistem, internet bağlantısı gerektirmez. Tüm iletişim yerel ağ üzerinden HTTP protokolü ile sağlanmaktadır.

---

## 3. KULLANILAN TEKNOLOJİLER

### 3.1 Backend Teknolojileri

Backend katmanı, Node.js 20 LTS üzerinde çalışan Express 4 framework'ü ile geliştirilmiştir. Veritabanı olarak MongoDB kullanılmış; Mongoose ODM kütüphanesi aracılığıyla nesne-belge eşlemesi sağlanmıştır. Gerçek zamanlı bildirimler için Socket.io 4.7 entegre edilmiştir.

Kimlik doğrulama, JSON Web Token (JWT) tabanlıdır: erişim tokenları 15 dakika, yenileme tokenları ise 7 gün geçerlidir. Şifreler bcrypt algoritmasıyla (12 tur) hashlenerek saklanmaktadır. Rate limiting, CORS kontrolü ve Helmet.js HTTP başlık güvenliği ek güvenlik katmanları olarak devreye alınmıştır.

Excel dosyası üretimi için ExcelJS kütüphanesi kullanılmıştır. E-posta gönderimi (şifremi unuttum özelliği) için Nodemailer entegrasyonu yapılmıştır. Veri doğrulama Zod şema kütüphanesi ile gerçekleştirilmektedir.

### 3.2 Frontend Teknolojileri

Kullanıcı arayüzü React 18 ve TypeScript kullanılarak geliştirilmiştir. Build aracı olarak Vite 5, stil yönetimi için ise Tailwind CSS tercih edilmiştir. Uygulama genelinde CSS değişkenleri (CSS Variables) tabanlı bir tema sistemi uygulanmıştır; bu sayede kullanıcı arayüzü renkleri ve görünümü çalışma zamanında dinamik olarak değiştirilebilmektedir.

Uygulama durum yönetimi Zustand kütüphanesi ile sağlanmaktadır. Form doğrulama için React Hook Form ve Zod birlikte kullanılmaktadır. Veri görselleştirme Recharts kütüphanesiyle gerçekleştirilmektedir. Uygulama ayrıca PWA (Progressive Web Application) standartlarına uymakta; bu sayede ağ bağlantısı koptuğunda belirli işlemler çevrimdışı kuyruğa alınabilmektedir.

### 3.3 Masaüstü Uygulama (Electron)

Electron 31 framework'ü ile Windows masaüstü uygulaması geliştirilmiştir. Bu uygulama; Node.js backend ve MongoDB binary dosyasını içinde barındırır, dolayısıyla kullanıcının ayrıca Node.js veya MongoDB kurmasına gerek yoktur. Yaklaşık 104 MB boyutundaki kurulum paketi (EXE) tek tıkla kurulum imkânı sunar.

Electron uygulaması, contextBridge ve preload.js mimarisi sayesinde web uygulamasına güvenli bir API köprüsü sunmaktadır. Bu köprü aracılığıyla sistem yazıcılarına erişim ve diyalogsuz (sessiz) termal yazıcı çıktısı alma mümkün olmaktadır.

### 3.4 Android Uygulama (Capacitor)

Capacitor 6 framework'ü ile mevcut React web uygulaması, yerel Android uygulamasına dönüştürülmüştür. Bununla birlikte, APK doğrudan web uygulamasını yüklemek yerine akıllı bir başlatıcı (launcher) sayfasıyla açılmaktadır. Bu sayede sunucu IP adresinin APK'ya sabit (hardcoded) yazılması zorunluluğu ortadan kalkmıştır.

---

## 4. VERİTABANI TASARIMI

Sistem, MongoDB belge tabanlı veritabanı kullanmaktadır. Başlıca koleksiyonlar şunlardır:

**users:** Personel kayıtlarını barındırır. Her kullanıcının kullanıcı adı, bcrypt ile hashlenmiş şifresi, tam adı, rolü (admin/manager/waiter), e-posta adresi ve aktiflik durumu saklanmaktadır.

**tables:** Masa bilgilerini tutar. Masa numarası, ismi, kapasitesi, bölümü (section) ve anlık durumu (available, occupied, reserved, cleaning) gibi alanlar yer alır.

**orders:** Sipariş belgelerini saklar. Her sipariş; müşteri kalemlerini (items[]) gömülü dizi olarak barındırır. Ödeme yöntemi, toplam tutar, KDV, indirim bilgisi, garson ve masa referansları ile kapanış zamanı bu koleksiyonda tutulur.

**menu_items:** Menü ürünü kayıtları. Ürün adı, açıklaması, fiyatı, maliyeti, stok miktarı, KDV oranı, kategori referansı ve aktiflik durumu bu koleksiyonda yer alır.

**settings:** Sistem genelindeki yapılandırma değerleri anahtar-değer (key-value) çifti olarak saklanır. Restoran adı, logo URL'si, fiş alt notu, tema yapılandırması bu koleksiyonda tutulur.

**reservations:** Rezervasyon kayıtları. Müşteri adı, telefonu, kişi sayısı, tarih-saat ve masa referansı içerir.

---

## 5. TEMEL ÖZELLİKLER

### 5.1 Masa Yönetimi

Sistem, restoranın fiziksel masa düzenini dijital ortamda temsil eder. Masalar bölümlere (section) ayrılabilir; iç mekan, teras, vip salon gibi gruplamalar yapılabilir. Her masanın anlık durumu tüm bağlı cihazlara Socket.io aracılığıyla gerçek zamanlı yansıtılır.

### 5.2 Sipariş ve Ödeme Modülü

Garsonlar tabletten veya PC'den sipariş alabilir; ürün ekleyebilir, çıkarabilir, iptal edebilir. Ödeme aşamasında nakit, kart, karma ödeme (nakit + kart) veya ikram seçenekleri mevcuttur. Nakit ödemede para üstü otomatik hesaplanır. Kısmi ödeme desteği de bulunmaktadır.

### 5.3 Raporlama ve Excel Export

Yöneticiler, ekran üzerindeki grafikler aracılığıyla günlük ciro, saatlik yoğunluk, haftalık satış trendi, kategori bazlı satış dağılımı ve garson performansını takip edebilir.

Excel export özelliği, ExcelJS kütüphanesiyle tam biçimlendirilmiş raporlar üretir. Günlük rapor üç sayfa içerir: Özet, Siparişler listesi ve Ürün Detayı. Haftalık rapor günlük özet verilerini içeren bir sayfa sunar. Garson raporu; sipariş adedi, ciro, nakit/kart kırılımı ve ortalama servis süresi gibi metrikler içerir. Stok raporu ise tükenmiş ürünleri kırmızı, düşük stoklulara sarı renkle işaretler.

Tüm tarih ve saat bilgileri Europe/Istanbul saat dilimine göre Intl.DateTimeFormat API'si ile formatlanmaktadır.

### 5.4 Çevrimdışı Kuyruk

Ağ bağlantısı geçici olarak kesildiğinde, gerçekleştirilen işlemler HMAC imzalı bir kuyrukta bekletilir. Bağlantı yeniden sağlandığında kuyruk otomatik olarak sunucuya gönderilir. HMAC imzası sayesinde kuyruk içeriğinin manipüle edilmesi önlenmektedir. Frontend ve backend'deki HMAC_SECRET değerinin aynı olması gerekmektedir.

### 5.5 Ayarlar ve Kişiselleştirme

Sistem yöneticisi, arayüz üzerinden restoran logosunu yükleyebilir veya değiştirebilir; restoran adı, adres, telefon ve vergi numarasını güncelleyebilir; fiş alt notunu düzenleyebilir. Tema sistemi, hazır tema presetlerinin yanı sıra renk editörü aracılığıyla tam özelleştirme imkânı sunar. Tema değişikliği gerçek zamanlı olarak tüm bağlı cihazlara yayınlanır.

---

## 6. GÜVENLİK YAKLAŞIMI

Sistem, çok katmanlı bir güvenlik mimarisi benimsemiştir:

**Kimlik doğrulama:** JWT tabanlı iki token yapısı. Kısa ömürlü erişim tokenı (15 dk) ve uzun ömürlü yenileme tokenı (7 gün). Refresh token'lar veritabanında saklanır ve çıkış yapıldığında geçersiz kılınır.

**Yetkilendirme:** Üç katmanlı rol sistemi. Admin tüm sistem işlemlerine erişebilirken, Müdür sipariş, menü ve rapor işlemlerini yönetebilir; Garson yalnızca masa ve sipariş işlemleri ile sınırlıdır.

**Giriş koruması:** Özel rate limiter ile 15 dakika içinde 20'den fazla başarısız giriş denemesi engellenebilir. Global API rate limiter de mevcuttur.

**Şifremi unuttum:** Sunucu tarafında zaman sınırlı (1 saatlik) token üretilerek kullanıcının e-posta adresine gönderilir. Token tek kullanımlıktır ve kullanımdan sonra geçersiz kılınır.

---

## 7. AKILLI SUNUCU KEŞİF MEKANİZMASI (ANDROID APK)

Android APK'nın karşılaştığı en kritik sorun, sunucunun IP adresinin APK içine sabit yazılması zorunluluğuydu. Restoran ağındaki IP atamaları değiştiğinde veya farklı bir mekânda kullanıldığında, APK çalışmaz hale geliyordu.

Bu sorunu çözmek için APK, doğrudan React uygulamasını yüklemek yerine akıllı bir başlatıcı HTML sayfasıyla başlatılacak şekilde yapılandırılmıştır. Başlatıcı sayfası şu adımları izler:

1. localStorage'da daha önce kayıtlı bir sunucu URL'si varsa, önce bu adrese /api/health ile bağlantı dener.
2. Bağlantı başarılı olursa doğrudan yönlendirir.
3. Başarısız olursa WebRTC peer bağlantısı aracılığıyla cihazın yerel ağ subnet'ini (örneğin 192.168.1.x) tespit eder.
4. Subnet'in 1 ile 254 arasındaki adreslerini 20'li gruplar halinde paralel olarak tarar.
5. Her IP için /api/health endpoint'ine istek gönderir; yanıt içindeki app alanının gastrosmart-pos değerini taşıyıp taşımadığını kontrol eder (parmak izi doğrulama).
6. Sunucu bulunduğunda URL localStorage'a kaydedilerek bir sonraki açılışta hızlı bağlantı sağlanır.

Bu yaklaşım sayesinde kullanıcı herhangi bir IP adresi bilgisi olmadan, APK'yı kurduğunda otomatik olarak doğru sunucuya bağlanır.

---

## 8. TERMAL YAZICI ENTEGRASYonu

Sistem iki farklı yazıcı kullanım senaryosunu destekler:

**Tarayıcı Modu:** Fiş önizleme ekranındaki "Yazdır" butonu tarayıcının yazdırma diyalogunu açar. Kullanıcı yazıcı listesinden termal yazıcısını seçer ve kağıt boyutunu (58mm veya 80mm) ayarlar.

**Electron Masaüstü Modu:** contextBridge mimarisi sayesinde, Electron preload.js dosyası aracılığıyla renderer sürecine güvenli bir yazıcı API'si sunulur. "Sessiz Yazdır" butonu, OS diyalogu açmadan fiş çıktısını doğrudan seçili termal yazıcıya gönderir. Kullanıcı, Ayarlar sayfasından sistem yazıcıları listesinden tercih ettiği yazıcıyı ve kağıt boyutunu seçebilir.

---

## 9. DEPLOYMENT VE KURULUM

### 9.1 Standart (PM2) Kurulum

Sunucu PC'ye Node.js 20 LTS ve MongoDB Community Server kurulur. MongoDB, Windows servisi olarak yapılandırılarak sistem açılışında otomatik başlatılır. npm bağımlılıkları yüklendikten ve veritabanı seed scripti çalıştırıldıktan sonra, frontend React uygulaması derlenerek backend/public/ klasörüne kopyalanır. PM2 ile backend servisi başlatılır ve Windows başlangıcına eklenir.

### 9.2 Electron (Hepsi Bir Arada) Kurulum

electron-builder ile üretilen kurulum paketi (yaklaşık 104 MB), MongoDB binary ve Node.js backend'i içinde barındırır. Kurulum paketi çalıştırıldığında sistem hazır hale gelir; ek kurulum adımı gerekmez.

### 9.3 Android APK

APK_OLUSTUR.bat batch dosyası çalıştırıldığında:
1. Capacitor, launcher dosyalarını Android projesine kopyalar.
2. Gradle assembleDebug komutu ile APK derlenir (Android Studio gerekmez).
3. Çıktı APK, proje kök dizinine GastroSmart-POS.apk olarak kopyalanır.
4. APK USB ile tablette kurulur.

---

## 10. SONUÇ

GastroSmart POS, küçük ve orta ölçekli restoran işletmelerinin ihtiyaç duyduğu tüm POS fonksiyonlarını internet bağımsız, düşük maliyetli ve kullanımı kolay bir platform üzerinde sunmaktadır. Modern web teknolojileri kullanılarak geliştirilmiş olan sistem; gerçek zamanlı çoklu cihaz desteği, akıllı Android APK sunucu keşfi, gömülü veritabanıyla tek paket Windows kurulumu ve USB termal yazıcı entegrasyonu gibi özgün çözümler barındırmaktadır.

Proje, yazılım geliştirme sürecinde karşılaşılan somut teknik zorluklara (saat dilimi hataları, IP tespiti, offline veri güvenliği, yazıcı erişimi) pratik mühendislik çözümleri üretilmesine de zemin hazırlamıştır. Mevcut sürüm (v1.0) tüm temel işlevleri karşılamakta olup mutfak ekranı, QR menü ve çoklu şube yönetimi gibi genişletmeler planlanan sonraki sürümler kapsamında değerlendirilmektedir.

---

*GastroSmart POS — Ara Teknik Rapor — Nisan 2026*
