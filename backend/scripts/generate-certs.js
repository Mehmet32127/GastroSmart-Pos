/**
 * GastroSmart POS — Self-Signed SSL Sertifikası Oluşturucu
 * Çalıştır: node scripts/generate-certs.js
 */

const selfsigned = require('selfsigned')
const fs = require('fs')
const path = require('path')
const os = require('os')

const CERTS_DIR = path.join(__dirname, '../certs')

function getLocalIPs() {
  const nets = os.networkInterfaces()
  const ips = ['localhost', '127.0.0.1']
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address)
      }
    }
  }
  return ips
}

async function generateCerts() {
  console.log('\n🔒 SSL Sertifikası Oluşturuluyor...\n')

  if (!fs.existsSync(CERTS_DIR)) {
    fs.mkdirSync(CERTS_DIR, { recursive: true })
  }

  const certPath = path.join(CERTS_DIR, 'cert.pem')
  const keyPath  = path.join(CERTS_DIR, 'key.pem')

  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    console.log('⏭  Sertifika zaten mevcut: ./certs/cert.pem')
    console.log('   Yeniden oluşturmak için önce silin.\n')
    return
  }

  const localIPs = getLocalIPs()
  console.log('📡 Yerel IP adresleri:')
  localIPs.forEach(ip => console.log(`   ${ip}`))

  const attrs = [
    { name: 'commonName', value: 'GastroSmart POS' },
    { name: 'organizationName', value: 'GastroSmart' },
    { name: 'countryName', value: 'TR' },
  ]

  const extensions = [
    { name: 'subjectAltName', altNames: [
      ...localIPs.map(ip =>
        ip === 'localhost' ? { type: 2, value: 'localhost' } : { type: 7, ip }
      )
    ]},
    { name: 'keyUsage', keyCertSign: true, digitalSignature: true, keyEncipherment: true },
    { name: 'extKeyUsage', serverAuth: true, clientAuth: true },
  ]

  console.log('\n⏳ Oluşturuluyor (birkaç saniye sürebilir)...')

  const pems = selfsigned.generate(attrs, {
    days: 3650, // 10 yıl
    algorithm: 'sha256',
    keySize: 2048,
    extensions,
  })

  fs.writeFileSync(certPath, pems.cert)
  fs.writeFileSync(keyPath,  pems.private)

  console.log('\n✅ Sertifika oluşturuldu:')
  console.log(`   📜 ${certPath}`)
  console.log(`   🔑 ${keyPath}`)
  console.log('\n⚠️  Tarayıcı uyarısı hakkında:')
  console.log('   Tarayıcı "Bu site güvenli değil" uyarısı verecek.')
  console.log('   → Chrome: "Gelişmiş" → "Yine de devam et" tıklayın')
  console.log('   → Bunu bir kez yapmanız yeterli.\n')
}

generateCerts().catch(err => {
  console.error('❌ Sertifika hatası:', err.message)
  process.exit(1)
})
