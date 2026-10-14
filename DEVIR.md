# Proje Devir Rehberi

Bu doküman GastroSmart POS projesini **başka bir bilgisayara / kişiye devretmek**
için gereken her şeyi tek yerde toplar. Canlı sistemi update ederken uyulacak
kurallar için ayrıca `DEPLOY.md` okunmalıdır.

## Önemli: Proje İki Parçadan Oluşur

| Parça | Nerede | Nasıl taşınır |
|---|---|---|
| **Frontend** (`frontend/`, `docs/`) | GitHub (bu repo) | `git clone` |
| **Backend** (`backend/`, `.env`), `electron/`, `*.bat`, `CLAUDE.md`, `TEKNIK_RAPOR.md` | **Sadece eski bilgisayarda** (`.gitignore` ile dışarıda) | Yedek zip'i (aşağıda) |

`git clone` tek başına **yetmez** — backend GitHub'da yoktur.

## 1. Eski Bilgisayarda: Tek Dosyalık Tam Yedek Al

Proje kökündeki **`YEDEK_AL.bat`** dosyasına çift tıkla
(arka planda `scripts/yedek.ps1` çalışır).

Sonuç: `D:\proje-yedekleri\GastroSmart-Pos_<tarih>.zip`

Bu zip projenin **tamamını** içerir (backend + `.env` + electron + bat dosyaları
dahil). Hariç tutulanlar: `node_modules`, `.git`, `dist`, `backups`,
`YUKLEYICILER`, gömülü `mongodb` binary'leri, `.exe/.apk` — hepsi yeniden
üretilebilir.

⚠️ Zip içinde **gizli anahtarlar** (`.env`: MongoDB bağlantısı, JWT, HMAC vb.)
var. USB ile veya şifreli şekilde ver; e-posta / WhatsApp / public repo ile
**gönderme**.

Ek olarak:
- [ ] Süper-admin → **"Yedeği İndir"** → veritabanı JSON yedeği
- [ ] Render → servis → **Environment** sekmesindeki tüm değişkenleri not al
- [ ] Render → servis → **Settings → Repository**: backend hangi repodan deploy
      ediliyor, kontrol et

## 2. Yeni Bilgisayara Kurulacak Programlar (Windows)

| Program | Adres |
|---|---|
| Git | https://git-scm.com |
| Node.js **LTS** (20 veya 22) | https://nodejs.org |
| VS Code (isteğe bağlı) | https://code.visualstudio.com |

Yeni bir PowerShell açıp kontrol:
```powershell
node -v
npm -v
git --version
```

## 3. Projeyi Yerleştir

GitHub'da yeni kişiye erişim ver: repo → **Settings → Collaborators → Add people**
(tam devir için: **Settings → General → Transfer ownership**).

```powershell
cd $HOME\Desktop
git config --global user.name  "Ad Soyad"
git config --global user.email "mail@ornek.com"
git clone https://github.com/Mehmet32127/GastroSmart-Pos.git
```

Sonra yedek zip'i açıp içindeki **GitHub'da olmayan** parçaları klonlanan
klasörün içine kopyala (üzerine yazma sorarsa frontend dosyaları için "hayır"):

- `backend\` (içindeki `.env` dahil)
- `electron\`
- `*.bat` dosyaları, `ecosystem.config.js`, `CLAUDE.md`, `TEKNIK_RAPOR.md`
- `frontend\.env.local` (varsa)

## 4. Bağımlılıkları Kur ve Çalıştır

**Backend:**
```powershell
cd GastroSmart-Pos\backend
npm install
npm run dev        # veya npm start — backend\package.json "scripts" kısmına bak
```
Kontrol: tarayıcıda `http://localhost:3001/api/health` JSON dönmeli.

**Frontend** (ayrı bir PowerShell penceresinde):
```powershell
cd GastroSmart-Pos\frontend
npm install
copy .env.example .env.local     # .env.local zip'ten geldiyse bu adımı atla
npm run dev
```
`.env.local` içindeki `VITE_HMAC_SECRET`, `backend\.env` içindeki `HMAC_SECRET`
ile **birebir aynı** olmalı. `VITE_API_URL` satırları yorumda kalmalı.

## 5. Render (Backend Canlı Ortamı)

Canlı backend: `https://gastrosmart-pos-backend.onrender.com`

**A) Mevcut servisi devret (URL değişmez — önerilen)**
Render → Workspace ayarları → **Members → Invite** ile yeni kişiyi ekle
(ücretli plan gerektirebilir; olmazsa Render hesabı + 2FA devredilir).

**B) Yeni kişinin kendi Render hesabında yeni servis**
1. Backend için GitHub'da **Private** repo aç ve `backend\` klasörünü yükle.
   `.env` **gitmemeli**:
   ```powershell
   cd backend
   "node_modules/`n.env`nlogs/`nbackups/`nuploads/`ndata/" | Out-File .gitignore -Encoding utf8
   git init
   git add .
   git commit -m "backend ilk yukleme"
   git branch -M main
   git remote add origin https://github.com/KULLANICI/gastrosmart-backend.git
   git push -u origin main
   ```
2. Render → **New → Web Service** → GitHub'ı bağla → bu repoyu seç
   - Build Command: `npm install`
   - Start Command: `npm start` (backend\package.json'a göre)
   - **Environment**: 1. adımda not alınan değişkenlerin hepsi
3. Kontrol: `https://<yeni-servis>.onrender.com/api/health`
4. URL değiştiği için frontend 6. adımdaki gibi **yeni URL ile** tekrar
   derlenmeli.

## 6. Frontend Canlı Ortamı (GitHub Pages)

Canlı site `docs/` klasöründen yayınlanır; `main` dalına push edilince
`.github/workflows/pages.yml` otomatik deploy eder.

```powershell
cd frontend
$env:GITHUB_PAGES="1"
$env:VITE_API_URL="https://gastrosmart-pos-backend.onrender.com"
$env:VITE_SOCKET_URL="https://gastrosmart-pos-backend.onrender.com"
npm run build
robocopy dist ..\docs /E
cd ..
git add docs
git commit -m "build: docs yeniden derlendi"
git push
```
`docs\zexra` klasörüne dokunma (`robocopy /E` silmez — `/MIR` **kullanma**).

## 7. Devredilecek Hesaplar

Hepsinde 2FA açık; ya yeni kişiyi üye olarak davet et ya da şifre + 2FA'yı devret.

- [ ] GitHub
- [ ] Render
- [ ] MongoDB Atlas (Project → Access Manager → Invite)
- [ ] Brevo (e-posta gönderimi)
- [ ] Gmail
- [ ] Sentry
- [ ] UptimeRobot

## 8. Son Kontrol

- [ ] Lokal backend `/api/health` çalışıyor
- [ ] Lokal frontend `npm run dev` ile açılıyor, giriş yapılabiliyor
- [ ] Render `/api/health` sürüm bilgisini gösteriyor
- [ ] Canlı sitede giriş + bir sipariş akışı sorunsuz
- [ ] Yeni kişi `DEPLOY.md` kurallarını okudu
- [ ] `YEDEK_AL.bat` yeni bilgisayarda çalışıyor (`scripts\yedek.ps1` içindeki
      `$BACKUP_ROOT` yolunu yeni bilgisayara göre düzenle)
