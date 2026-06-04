# ============================================================================
#  Proje Yedekleme — git (off-site) + yerel zip arsiv
#
#  Ne yapar:
#   1) Kaydedilmemis degisiklik varsa "yedek: <tarih>" commit'i atar
#   2) GitHub'a (origin) push eder  -> off-site yedek (DIKKAT: .gitignore
#      backend/ ve electron/ klasorlerini dista tutuyor, yani GitHub SADECE
#      frontend'i yedekler)
#   3) Projenin TAMAMINI (backend dahil! .env dahil!) tek bir .zip'e arsivler
#      -> yerel diske kaydeder. Backend GitHub'da olmadigi icin asil tam yedek
#         BUDUR. node_modules/installer/mongodb-binary gibi turetilebilir
#         seyler haric tutulur.
#   4) Son 10 zip'i tutar, eskileri siler
#
#  ONEMLI: Bu zip backend kodunu ve .env (gizli anahtarlar/baglanti dizesi)
#  icerir. BACKUP_ROOT'u guvenli + makine disi bir yere (USB / OneDrive /
#  Drive ile senkron klasor) koy ki disk bozulsa bile backend yedegin dursun.
#
#  Calistirma: YEDEK_AL.bat dosyasina cift tikla (bu scripti o cagirir).
# ============================================================================

$ErrorActionPreference = 'Stop'

# --- Ayarlar ---------------------------------------------------------------
# Yerel yedeklerin kaydedilecegi klasor. Daha guvenli olmasi icin bunu
# bir USB diske ya da OneDrive/Drive ile senkronize bir klasore tasiyabilirsin.
$BACKUP_ROOT = 'D:\proje-yedekleri'
$KEEP_COUNT  = 10   # kac zip saklanacak

# --- Hazirlik --------------------------------------------------------------
$proj  = Split-Path -Parent $PSScriptRoot          # proje koku (scripts'in ust klasoru)
$name  = Split-Path -Leaf  $proj
$stamp = Get-Date -Format 'yyyy-MM-dd_HHmm'
New-Item -ItemType Directory -Force -Path $BACKUP_ROOT | Out-Null
Set-Location $proj

Write-Host "==> Proje: $name" -ForegroundColor Cyan

# --- 1 + 2) GIT: commit (gerekirse) + push --------------------------------
$onGit = Test-Path (Join-Path $proj '.git')
if ($onGit) {
  $dirty = git status --porcelain
  if ($dirty) {
    git add -A
    git commit -m "yedek: $stamp" | Out-Null
    Write-Host "    [git] degisiklikler 'yedek: $stamp' olarak commit'lendi." -ForegroundColor Green
  } else {
    Write-Host "    [git] kaydedilmemis degisiklik yok." -ForegroundColor DarkGray
  }
  try {
    git push origin HEAD
    Write-Host "    [git] GitHub'a push edildi (off-site yedek tamam)." -ForegroundColor Green
  } catch {
    Write-Host "    [git] PUSH BASARISIZ — internet/kimlik dogrulamayi kontrol et. Yerel zip yine de alinacak." -ForegroundColor Yellow
  }
} else {
  Write-Host "    [git] bu klasor bir git deposu degil — git adimi atlandi." -ForegroundColor Yellow
}

# --- 3) Yerel ZIP arsiv ----------------------------------------------------
$stage = Join-Path $env:TEMP "yedek_${name}_$stamp"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }

# robocopy ile staging'e kopyala; agir/turetilebilir seyleri haric tut.
# (backend/ ve electron/assets DAHIL edilir; sadece binary/build ciktilari atilir)
#  - mongodb       : electron'a gomulu MongoDB binary'leri (~74MB, indirilebilir)
#  - YUKLEYICILER  : APK/EXE installer ciktilari (~110MB, yeniden uretilir)
robocopy $proj $stage /MIR `
  /XD node_modules .git dist build dist-electron .next coverage backups YUKLEYICILER mongodb `
  /XF *.log npm-debug.log* *.exe *.apk *.dmg *.AppImage `
  /NFL /NDL /NJH /NJS /NP /R:1 /W:1 | Out-Null

$zip = Join-Path $BACKUP_ROOT "${name}_$stamp.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip
Remove-Item $stage -Recurse -Force

$sizeMB = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host "    [zip] Yerel yedek: $zip ($sizeMB MB)" -ForegroundColor Green

# --- 4) Eski yedekleri temizle (son $KEEP_COUNT kalir) --------------------
$old = Get-ChildItem $BACKUP_ROOT -Filter "${name}_*.zip" |
       Sort-Object LastWriteTime -Descending | Select-Object -Skip $KEEP_COUNT
foreach ($f in $old) { Remove-Item $f.FullName -Force; Write-Host "    [zip] eski silindi: $($f.Name)" -ForegroundColor DarkGray }

Write-Host "==> YEDEK TAMAMLANDI." -ForegroundColor Cyan
