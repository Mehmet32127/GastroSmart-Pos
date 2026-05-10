# Deploy ve Update Kuralları

Bu doküman **canlı sistemi update ederken** sipariş verilerinin korunması
ve hizmet kesintisinin minimum olması için izlenmesi gereken kuralları içerir.

## Sürüm Yönetimi

[Semantic Versioning](https://semver.org/) uygulanır:

| Tip | Ne zaman | Örnek |
|---|---|---|
| **patch** (1.0.0 → 1.0.1) | Bug fix, kullanıcı dışına etki yok | Login hatası düzeltme |
| **minor** (1.0.0 → 1.1.0) | Yeni özellik, geriye uyumlu | Stok Sayım eklendi |
| **major** (1.0.0 → 2.0.0) | Geriye uyumlu olmayan değişiklik | Schema'da alan silindi |

### Yeni sürüm yayınlama

```bash
# Backend için
cd backend
npm run release:patch    # bug fix
npm run release:minor    # özellik
npm run release:major    # ciddi değişiklik

# Frontend için (manuel)
cd frontend
npm version patch         # 1.0.0 → 1.0.1
git push --follow-tags
```

`npm version` otomatik olarak:
1. `package.json` versiyonu artırır
2. Git commit oluşturur (`chore(release): 1.1.0`)
3. Git tag ekler (`v1.1.0`)
4. `git push --follow-tags` ile uzaktaki repo'ya yollar
5. Render auto-deploy + GitHub Pages auto-deploy

### Sürüm öncesi
`preversion` script'i `npm test` çalıştırır. Test başarısızsa version atılmaz.

## Veri Güvenliği — Update Sırasında Sipariş Silinmesini Önleme

### Kural 1: Schema Add-Only

MongoDB schema-on-read'tir; yeni field eklemek **mevcut kayıtları bozmaz**.

✅ **GÜVENLİ**:
```js
// Yeni alan eklemek
const orderSchema = new Schema({
  ...,
  newField: { type: String, default: null }   // optional + default
})
```

❌ **TEHLİKELİ**:
```js
// Mevcut alanı zorunlu yapmak
existingField: { type: String, required: true }   // eski kayıtlarda yoksa save çağrılınca hata
```

### Kural 2: Field Silme — Aşamalı

Bir alan silinmeden önce **iki sürüm bekle**:

1. **Sürüm N**: alan optional yapılır, kod kullanmıyor (deprecated)
2. **Sürüm N+1**: alan tamamen kaldırılır

Bu, eski deploy'a hızlı dönüş yapılırsa veri kaybını önler.

### Kural 3: Type Değişikliği — Migration Şart

Bir alanın tipi değişiyorsa (örn. String → Number), önce migration script
çalıştırılmalı:

```bash
node scripts/migrate-field-type.js
```

Schema'yı sadece migration başarılı olduktan sonra değiştir.

### Kural 4: Index Eklemeden Önce

Production'da büyük koleksiyonlara index eklemek MongoDB'yi yavaşlatır.
Background index eklenmesi önerilir:

```js
schema.index({ field: 1 }, { background: true })
```

## Pre-Deploy Checklist

Her deploy öncesi:

- [ ] **Yedek alındı mı?** Süper-admin → "Yedeği İndir" → JSON dosyası kasaya
- [ ] **Test geçti mi?** `npm test` → 13/13
- [ ] **Migration gerekli mi?** Schema değişti mi, breaking mi?
- [ ] **Aktif sipariş var mı?** Hesap kapama saatinde deploy etme
- [ ] **CHANGELOG güncel mi?** Bu sürümde ne değişti yazılı

## Deploy Anı

Render free tier'da rolling deployment yok — bir restart süresince
~10-30 saniye servis kesintisi olur. Bu sürede:

- ✅ Devam eden HTTP istekleri tamamlanır (graceful)
- ✅ MongoDB bağlantısı korunur (Atlas tarafı)
- ❌ Yeni gelen istekler 503 alır (~10sn)
- ❌ WebSocket bağlantıları kopar (frontend otomatik yeniden bağlanır)

**Önerim**: deploy'u **müşterinin yoğun saatleri dışında** yap (gece 03:00,
sabah 06:00 gibi).

## Deploy Sonrası

- [ ] Health check yeşil mi? → `https://gastrosmart-pos-backend.onrender.com/api/health`
- [ ] Sentry'de yeni error var mı? → dashboard kontrol
- [ ] UptimeRobot uptime devam ediyor mu? → grafik kontrol
- [ ] Bir test kullanıcı ile login dene, kritik akışı yap

## Rollback

Sorun çıkarsa:

```bash
git revert HEAD          # son commit'i geri al
git push                 # otomatik deploy yapılır
```

Schema değişikliği rollback'i daha karmaşık. Daima yedek elde tut.

## Versiyonu Görme

Health endpoint'i:
```bash
curl https://gastrosmart-pos-backend.onrender.com/api/health
# {"version":"1.1.0",...}
```

Frontend tarayıcı console'unda:
```js
console.log(import.meta.env.VITE_RELEASE_VERSION)
```
