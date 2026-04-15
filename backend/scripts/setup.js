/**
 * GastroSmart POS — İlk Kurulum & Demo Veri
 * Çalıştır: node scripts/setup.js
 */

const bcrypt = require('bcryptjs')
const path = require('path')
const fs = require('fs')

// Load .env first
require('dotenv').config({ path: path.join(__dirname, '../.env') })

const { getDb } = require('../src/config/database')

async function setup() {
  console.log('\n🚀 GastroSmart POS — Kurulum Başlıyor...\n')

  const db = getDb()

  // ─── 1. Admin kullanıcı ──────────────────────────────────────────────────
  console.log('👤 Kullanıcılar oluşturuluyor...')

  const users = [
    { username: 'admin',   password: 'admin123',   fullName: 'Sistem Yöneticisi', role: 'admin' },
    { username: 'mudur',   password: 'mudur123',   fullName: 'Ahmet Müdür',       role: 'manager' },
    { username: 'garson1', password: 'garson123',  fullName: 'Mehmet Garson',     role: 'waiter' },
    { username: 'garson2', password: 'garson123',  fullName: 'Fatma Garson',      role: 'waiter' },
  ]

  for (const u of users) {
    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(u.username)
    if (!exists) {
      const hash = await bcrypt.hash(u.password, 12)
      db.prepare('INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)')
        .run(u.username, hash, u.fullName, u.role)
      console.log(`   ✓ ${u.username} (${u.role}) — şifre: ${u.password}`)
    } else {
      console.log(`   ⏭  ${u.username} zaten mevcut`)
    }
  }

  // ─── 2. Masalar ──────────────────────────────────────────────────────────
  console.log('\n🪑 Masalar oluşturuluyor...')

  const tableCount = db.prepare('SELECT COUNT(*) as n FROM tables').get().n
  if (tableCount === 0) {
    const tables = [
      // Salon A — 10 masa
      { number: 1,  name: 'Masa 1',  capacity: 2, section: 'Salon A' },
      { number: 2,  name: 'Masa 2',  capacity: 2, section: 'Salon A' },
      { number: 3,  name: 'Masa 3',  capacity: 4, section: 'Salon A' },
      { number: 4,  name: 'Masa 4',  capacity: 4, section: 'Salon A' },
      { number: 5,  name: 'Masa 5',  capacity: 4, section: 'Salon A' },
      { number: 6,  name: 'Masa 6',  capacity: 6, section: 'Salon A' },
      { number: 7,  name: 'Masa 7',  capacity: 6, section: 'Salon A' },
      { number: 8,  name: 'Masa 8',  capacity: 8, section: 'Salon A' },
      // Teras — 5 masa
      { number: 9,  name: 'Teras 1', capacity: 4, section: 'Teras' },
      { number: 10, name: 'Teras 2', capacity: 4, section: 'Teras' },
      { number: 11, name: 'Teras 3', capacity: 6, section: 'Teras' },
      { number: 12, name: 'Teras 4', capacity: 6, section: 'Teras' },
      // VIP
      { number: 13, name: 'VIP 1',   capacity: 8,  section: 'VIP' },
      { number: 14, name: 'VIP 2',   capacity: 10, section: 'VIP' },
      // Bar
      { number: 15, name: 'Bar 1',   capacity: 2, section: 'Bar' },
      { number: 16, name: 'Bar 2',   capacity: 2, section: 'Bar' },
      { number: 17, name: 'Bar 3',   capacity: 2, section: 'Bar' },
    ]

    const stmt = db.prepare('INSERT INTO tables (number, name, capacity, section) VALUES (?, ?, ?, ?)')
    tables.forEach(t => {
      stmt.run(t.number, t.name, t.capacity, t.section)
    })
    console.log(`   ✓ ${tables.length} masa oluşturuldu`)
  } else {
    console.log(`   ⏭  ${tableCount} masa zaten mevcut`)
  }

  // ─── 3. Kategoriler ───────────────────────────────────────────────────────
  console.log('\n📂 Menü kategorileri oluşturuluyor...')

  const catCount = db.prepare('SELECT COUNT(*) as n FROM categories').get().n
  if (catCount === 0) {
    const categories = [
      { name: 'Başlangıçlar',  icon: '🥗', color: '#22c55e', sortOrder: 1 },
      { name: 'Ana Yemekler',  icon: '🍽️', color: '#f59e0b', sortOrder: 2 },
      { name: 'Izgara & Et',   icon: '🥩', color: '#ef4444', sortOrder: 3 },
      { name: 'Balık & Deniz', icon: '🐟', color: '#3b82f6', sortOrder: 4 },
      { name: 'Pizza & Makarna',icon: '🍕',color: '#f97316', sortOrder: 5 },
      { name: 'Salatalar',     icon: '🥙', color: '#84cc16', sortOrder: 6 },
      { name: 'Çorbalar',      icon: '🍲', color: '#eab308', sortOrder: 7 },
      { name: 'Tatlılar',      icon: '🍰', color: '#ec4899', sortOrder: 8 },
      { name: 'Sıcak İçecekler',icon: '☕', color: '#a78bfa', sortOrder: 9 },
      { name: 'Soğuk İçecekler',icon: '🥤', color: '#06b6d4', sortOrder: 10 },
      { name: 'Alkollü',       icon: '🍷', color: '#dc2626', sortOrder: 11 },
    ]

    const stmt = db.prepare('INSERT INTO categories (name, icon, color, sort_order) VALUES (?, ?, ?, ?)')
    categories.forEach(c => stmt.run(c.name, c.icon, c.color, c.sortOrder))
    console.log(`   ✓ ${categories.length} kategori oluşturuldu`)
  } else {
    console.log(`   ⏭  ${catCount} kategori zaten mevcut`)
  }

  // ─── 4. Menü Ürünleri ────────────────────────────────────────────────────
  console.log('\n🍴 Menü ürünleri oluşturuluyor...')

  const itemCount = db.prepare('SELECT COUNT(*) as n FROM menu_items').get().n
  if (itemCount === 0) {
    const cats = db.prepare('SELECT id, name FROM categories').all()
    const catMap = Object.fromEntries(cats.map(c => [c.name, c.id]))

    const items = [
      // Başlangıçlar
      { cat: 'Başlangıçlar', name: 'Ezme',              price: 65,  cost: 20, tax: 8, stock: 50, unit: 'porsiyon' },
      { cat: 'Başlangıçlar', name: 'Humus',             price: 75,  cost: 25, tax: 8, stock: 40, unit: 'porsiyon' },
      { cat: 'Başlangıçlar', name: 'Sigara Böreği (5 Adet)', price: 85, cost: 30, tax: 8, stock: 60, unit: 'porsiyon' },
      { cat: 'Başlangıçlar', name: 'Mercimek Çorbası',  price: 75,  cost: 20, tax: 8 },
      { cat: 'Başlangıçlar', name: 'Cacık',             price: 60,  cost: 15, tax: 8, stock: 30, unit: 'porsiyon' },
      // Ana Yemekler
      { cat: 'Ana Yemekler', name: 'Karışık Kebap',     price: 380, cost: 140, tax: 8 },
      { cat: 'Ana Yemekler', name: 'Patlıcan Kebabı',   price: 340, cost: 120, tax: 8 },
      { cat: 'Ana Yemekler', name: 'Kuru Fasulye',      price: 150, cost: 40, tax: 8 },
      { cat: 'Ana Yemekler', name: 'İzmir Köfte',       price: 280, cost: 100, tax: 8 },
      { cat: 'Ana Yemekler', name: 'Kuzu Tandır',       price: 450, cost: 180, tax: 8 },
      // Izgara & Et
      { cat: 'Izgara & Et',  name: 'Antrikot (300g)',   price: 580, cost: 250, tax: 8, stock: 20, unit: 'porsiyon' },
      { cat: 'Izgara & Et',  name: 'Dana Bonfile',      price: 650, cost: 280, tax: 8, stock: 15, unit: 'porsiyon' },
      { cat: 'Izgara & Et',  name: 'Tavuk Şiş',        price: 280, cost: 90, tax: 8 },
      { cat: 'Izgara & Et',  name: 'Adana Kebap',      price: 320, cost: 110, tax: 8 },
      { cat: 'Izgara & Et',  name: 'Urfa Kebap',       price: 310, cost: 110, tax: 8 },
      // Balık & Deniz
      { cat: 'Balık & Deniz', name: 'Levrek (500g)',   price: 480, cost: 200, tax: 8, stock: 10, unit: 'porsiyon' },
      { cat: 'Balık & Deniz', name: 'Çipura (500g)',   price: 450, cost: 190, tax: 8, stock: 10, unit: 'porsiyon' },
      { cat: 'Balık & Deniz', name: 'Karides Güveç',   price: 380, cost: 160, tax: 8, stock: 8, unit: 'porsiyon' },
      // Pizza & Makarna
      { cat: 'Pizza & Makarna', name: 'Margarita Pizza', price: 220, cost: 70, tax: 8 },
      { cat: 'Pizza & Makarna', name: 'Karışık Pizza',   price: 270, cost: 90, tax: 8 },
      { cat: 'Pizza & Makarna', name: 'Spagetti Bolonez', price: 200, cost: 65, tax: 8 },
      { cat: 'Pizza & Makarna', name: 'Fettucine Alfredo', price: 220, cost: 70, tax: 8 },
      // Salatalar
      { cat: 'Salatalar', name: 'Çoban Salata',        price: 90,  cost: 25, tax: 8 },
      { cat: 'Salatalar', name: 'Akdeniz Salatası',    price: 120, cost: 40, tax: 8 },
      { cat: 'Salatalar', name: 'Caesar Salata',       price: 150, cost: 55, tax: 8 },
      // Tatlılar
      { cat: 'Tatlılar', name: 'Künefe',               price: 150, cost: 45, tax: 8 },
      { cat: 'Tatlılar', name: 'Sütlaç',               price: 90,  cost: 25, tax: 8 },
      { cat: 'Tatlılar', name: 'Cheesecake',           price: 130, cost: 45, tax: 8 },
      { cat: 'Tatlılar', name: 'Çikolatalı Sufle',     price: 140, cost: 50, tax: 8, stock: 20, unit: 'porsiyon' },
      // Sıcak İçecekler
      { cat: 'Sıcak İçecekler', name: 'Türk Kahvesi',  price: 65,  cost: 12, tax: 18 },
      { cat: 'Sıcak İçecekler', name: 'Çay',           price: 25,  cost: 3,  tax: 18 },
      { cat: 'Sıcak İçecekler', name: 'Nescafé',       price: 75,  cost: 15, tax: 18 },
      { cat: 'Sıcak İçecekler', name: 'Sıcak Çikolata', price: 90, cost: 20, tax: 18 },
      // Soğuk İçecekler
      { cat: 'Soğuk İçecekler', name: 'Ayran',         price: 35,  cost: 8,  tax: 18, stock: 100, unit: 'adet' },
      { cat: 'Soğuk İçecekler', name: 'Cola (Şişe)',   price: 60,  cost: 20, tax: 18, stock: 80,  unit: 'adet' },
      { cat: 'Soğuk İçecekler', name: 'Su (0.5L)',     price: 15,  cost: 3,  tax: 18, stock: 200, unit: 'adet' },
      { cat: 'Soğuk İçecekler', name: 'Meyve Suyu',    price: 55,  cost: 18, tax: 18, stock: 60,  unit: 'adet' },
      { cat: 'Soğuk İçecekler', name: 'Limonata',      price: 75,  cost: 15, tax: 18 },
      // Alkollü
      { cat: 'Alkollü', name: 'Efes Bira (Şişe)',      price: 120, cost: 40, tax: 18, stock: 50, unit: 'adet' },
      { cat: 'Alkollü', name: 'Şarap (Kadeh)',         price: 180, cost: 70, tax: 18 },
      { cat: 'Alkollü', name: 'Şarap (Şişe)',          price: 650, cost: 280, tax: 18, stock: 20, unit: 'şişe' },
      { cat: 'Alkollü', name: 'Rakı (Tek)',            price: 150, cost: 55, tax: 18 },
    ]

    const stmt = db.prepare(
      'INSERT INTO menu_items (category_id, name, price, cost, stock, min_stock, unit, tax) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    let created = 0
    items.forEach(item => {
      const catId = catMap[item.cat]
      if (catId) {
        stmt.run(catId, item.name, item.price, item.cost || null, item.stock || null, item.stock ? 5 : null, item.unit || 'porsiyon', item.tax)
        created++
      }
    })
    console.log(`   ✓ ${created} ürün oluşturuldu`)
  } else {
    console.log(`   ⏭  ${itemCount} ürün zaten mevcut`)
  }

  // ─── 5. Varsayılan Ayarlar ─────────────────────────────────────────────────
  console.log('\n⚙️  Ayarlar yapılandırılıyor...')
  const settingsToSet = [
    ['restaurant_name', process.env.RESTAURANT_NAME || 'Restoranım'],
    ['receipt_footer', 'Teşekkürler! Bizi tercih ettiğiniz için mutluyuz.'],
    ['currency', 'TRY'],
    ['timezone', 'Europe/Istanbul'],
  ]
  for (const [key, value] of settingsToSet) {
    const existing = db.prepare('SELECT key FROM settings WHERE key = ?').get(key)
    if (!existing) {
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, value)
    }
  }
  console.log('   ✓ Varsayılan ayarlar yüklendi')

  // ─── Özet ─────────────────────────────────────────────────────────────────
  console.log('\n╔════════════════════════════════════════╗')
  console.log('║         ✅ Kurulum Tamamlandı!           ║')
  console.log('╚════════════════════════════════════════╝')
  console.log('\n📋 Giriş Bilgileri:')
  console.log('   admin    / admin123    (Yönetici)')
  console.log('   mudur    / mudur123    (Müdür)')

  console.log('   garson1  / garson123   (Garson)')
  console.log('\n⚠️  ÖNEMLİ: Sunucuya geçmeden önce şifreleri değiştirin!\n')
}

setup().catch(err => {
  console.error('❌ Kurulum hatası:', err.message)
  process.exit(1)
})
