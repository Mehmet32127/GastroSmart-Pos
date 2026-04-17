/**
 * GastroSmart POS — Acil Durum Admin Şifre Sıfırlama
 *
 * Kullanım: Sunucu bilgisayarında (Electron'un kurulu olduğu PC) admin
 * şifresini unutunca çalıştırılır. Fiziksel makine erişimi gerektirdiği
 * için güvenli bir kurtarma yoludur.
 *
 * Çalıştırma (geliştirici modu):
 *   cd backend
 *   node scripts/reset-admin.js [yeniSifre]
 *
 * Çalıştırma (kurulu EXE modunda):
 *   1. Başlat menüsünden "Komut İstemi" aç
 *   2. Kurulum klasörüne git:
 *      cd "%LOCALAPPDATA%\Programs\GastroSmart POS\resources\backend"
 *   3. Çalıştır:
 *      "%LOCALAPPDATA%\Programs\GastroSmart POS\GastroSmart POS.exe" --run-as-node scripts/reset-admin.js yeniSifre123
 *
 * Argüman verilmezse yeni şifre "admin123" olur.
 */

const mongoose = require('mongoose')
const path     = require('path')

require('dotenv').config({ path: path.join(__dirname, '../.env') })

const User = require('../src/models/User')

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gastrosmart'
const newPassword = (process.argv[2] || 'admin123').trim()

if (newPassword.length < 6) {
  console.error('❌ Şifre en az 6 karakter olmalı.')
  process.exit(1)
}

async function main() {
  console.log('🔌 MongoDB bağlanılıyor:', MONGO_URI)
  await mongoose.connect(MONGO_URI)

  // İlk admin kullanıcıyı bul (birden fazla admin varsa en eskiyi seç)
  let admin = await User.findOne({ role: 'admin' }).sort({ createdAt: 1 })

  if (!admin) {
    // Hiç admin yok → yeni admin oluştur
    console.log('⚠️  Hiç admin kullanıcı yok. Yeni admin oluşturuluyor...')
    admin = await User.create({
      username:      'admin',
      password_hash: newPassword,   // pre-save hook hash'ler
      full_name:     'Yönetici',
      role:          'admin',
      is_active:     true,
    })
    console.log(`✅ Yeni admin oluşturuldu.`)
  } else {
    admin.password_hash = newPassword   // pre-save hook yeniden hash'ler
    admin.is_active     = true          // pasif ise aktifleştir
    await admin.save()
    console.log(`✅ Admin şifresi sıfırlandı.`)
  }

  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('   Kullanıcı adı : ' + admin.username)
  console.log('   Yeni şifre    : ' + newPassword)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('⚠️  Giriş yaptıktan sonra şifreyi değiştirmeniz önerilir.')

  await mongoose.disconnect()
  process.exit(0)
}

main().catch(err => {
  console.error('❌ Hata:', err.message)
  process.exit(1)
})
