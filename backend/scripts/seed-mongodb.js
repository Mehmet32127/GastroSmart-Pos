/**
 * GastroSmart POS — MongoDB Seed Script
 * Run: npm run seed
 *
 * Safe to run multiple times: each section is skipped when data already exists.
 */

const mongoose = require('mongoose')
const path     = require('path')

require('dotenv').config({ path: path.join(__dirname, '../.env') })

const User     = require('../src/models/User')
const Table    = require('../src/models/Table')
const Category = require('../src/models/Category')
const MenuItem = require('../src/models/MenuItem')
const Settings = require('../src/models/Settings')

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gastrosmart'

// ─────────────────────────────────────────────────────────────────────────────

async function seedUsers() {
  const count = await User.countDocuments()
  if (count > 0) { console.log(`  ℹ️  ${count} kullanıcı zaten mevcut`); return }

  await User.create([
    { username: 'admin',   password_hash: 'admin123',   full_name: 'Yönetici',  role: 'admin',   email: 'admin@gastrosmart.local',   phone: '+90 555 000 0000', is_active: true },
    { username: 'manager', password_hash: 'manager123', full_name: 'Müdür',     role: 'manager', email: 'manager@gastrosmart.local', phone: '+90 555 000 0001', is_active: true },
    { username: 'garson1', password_hash: 'garson123',  full_name: '1. Garson', role: 'waiter',  email: 'garson1@gastrosmart.local', phone: '+90 555 000 0002', is_active: true },
    { username: 'garson2', password_hash: 'garson123',  full_name: '2. Garson', role: 'waiter',  email: 'garson2@gastrosmart.local', phone: '+90 555 000 0003', is_active: true },
  ])
  console.log('  ✅ 4 kullanıcı oluşturuldu')
}

async function seedTables() {
  const count = await Table.countDocuments()
  if (count > 0) { console.log(`  ℹ️  ${count} masa zaten mevcut`); return }

  const tables = [
    // Salon 1-10
    ...Array.from({ length: 10 }, (_, i) => ({
      number: i + 1, name: `Masa ${i + 1}`,       capacity: 4, section: 'salon',    status: 'available',
    })),
    // Balkon 11-15
    ...Array.from({ length: 5 }, (_, i) => ({
      number: 11 + i, name: `Balkon ${i + 1}`,    capacity: 4, section: 'balkon',   status: 'available',
    })),
    // Teras 16-20
    ...Array.from({ length: 5 }, (_, i) => ({
      number: 16 + i, name: `Teras ${i + 1}`,     capacity: 2, section: 'teras',    status: 'available',
    })),
    // VIP 21-22
    ...Array.from({ length: 2 }, (_, i) => ({
      number: 21 + i, name: `VIP ${i + 1}`,       capacity: 8, section: 'vip',      status: 'available',
    })),
  ]

  await Table.insertMany(tables)
  console.log(`  ✅ ${tables.length} masa oluşturuldu`)
}

async function seedMenu() {
  const existingCats = await Category.find().lean()
  const existingCatNames = new Set(existingCats.map(c => c.name))
  const isFirstRun = existingCats.length === 0

  const catDefs = [
    { name: 'Çorbalar',            icon: '🥣', color: '#4ECDC4', sort_order: 1,  is_active: true },
    { name: 'Salatalar',           icon: '🥗', color: '#95E1D3', sort_order: 2,  is_active: true },
    { name: 'Mezeler',             icon: '🍽️', color: '#F38181', sort_order: 3,  is_active: true },
    { name: 'Ana Yemekler',        icon: '🥘', color: '#FF6B6B', sort_order: 4,  is_active: true },
    { name: 'Etler & Kebaplar',    icon: '🍖', color: '#AA96DA', sort_order: 5,  is_active: true },
    { name: 'Balık & Deniz',       icon: '🐟', color: '#55B4D4', sort_order: 6,  is_active: true },
    { name: 'Tatlılar',            icon: '🍰', color: '#FFB6C1', sort_order: 7,  is_active: true },
    { name: 'Kahveler',            icon: '☕', color: '#8B6F47', sort_order: 8,  is_active: true },
    { name: 'Sıcak İçecekler',     icon: '🍵', color: '#E8C49A', sort_order: 9,  is_active: true },
    { name: 'Soğuk İçecekler',     icon: '🥤', color: '#A0C4D4', sort_order: 10, is_active: true },
    { name: 'Alkollü İçecekler',   icon: '🍷', color: '#C084FC', sort_order: 11, is_active: true },
  ]

  // Eksik kategorileri ekle (mevcutlara dokunma)
  const newCats = catDefs.filter(c => !existingCatNames.has(c.name))
  if (newCats.length > 0) {
    await Category.create(newCats)
    console.log(`  ✅ ${newCats.length} yeni kategori eklendi`)
  } else if (isFirstRun) {
    console.log('  ℹ️  Hiç kategori yok')
  } else {
    console.log(`  ℹ️  ${existingCats.length} kategori zaten mevcut (yeni eklenen yok)`)
  }

  // Build name→id map (tüm kategorilerden)
  const allCats = await Category.find().lean()
  const c = Object.fromEntries(allCats.map(cat => [cat.name, cat._id]))

  const items = [
    // ── Çorbalar ──────────────────────────────────────────────────────────────
    { category_id: c['Çorbalar'],          name: 'Mercimek Çorbası',    price: 35,  cost: 8,  tax: 8,  unit: 'kase', is_vegetarian: true,  preparation_time: 5  },
    { category_id: c['Çorbalar'],          name: 'Tavuk Çorbası',       price: 40,  cost: 12, tax: 8,  unit: 'kase', preparation_time: 5  },
    { category_id: c['Çorbalar'],          name: 'Ezogelin Çorbası',    price: 35,  cost: 8,  tax: 8,  unit: 'kase', is_vegan: true,       preparation_time: 5  },

    // ── Salatalar ─────────────────────────────────────────────────────────────
    { category_id: c['Salatalar'],         name: 'Çoban Salatası',      price: 45,  cost: 10, tax: 8,  unit: 'porsiyon', is_vegan: true,   preparation_time: 3  },
    { category_id: c['Salatalar'],         name: 'Mevsim Salatası',     price: 50,  cost: 12, tax: 8,  unit: 'porsiyon', is_vegan: true,   preparation_time: 3  },
    { category_id: c['Salatalar'],         name: 'Sezar Salatası',      price: 65,  cost: 18, tax: 8,  unit: 'porsiyon', is_vegetarian: true, preparation_time: 5 },

    // ── Mezeler ───────────────────────────────────────────────────────────────
    { category_id: c['Mezeler'],           name: 'Humus',               price: 45,  cost: 10, tax: 8,  unit: 'porsiyon', is_vegan: true,   preparation_time: 2  },
    { category_id: c['Mezeler'],           name: 'Cacık',               price: 40,  cost: 8,  tax: 8,  unit: 'porsiyon', is_vegetarian: true, preparation_time: 2 },
    { category_id: c['Mezeler'],           name: 'Patlıcan Salatası',   price: 50,  cost: 12, tax: 8,  unit: 'porsiyon', is_vegan: true,   preparation_time: 3  },

    // ── Ana Yemekler ──────────────────────────────────────────────────────────
    { category_id: c['Ana Yemekler'],      name: 'Köfte',               price: 85,  cost: 25, tax: 8,  unit: 'porsiyon', is_spicy: false,  preparation_time: 15 },
    { category_id: c['Ana Yemekler'],      name: 'Piliç Şnizel',        price: 95,  cost: 30, tax: 8,  unit: 'porsiyon', preparation_time: 12 },
    { category_id: c['Ana Yemekler'],      name: 'Mantı',               price: 75,  cost: 20, tax: 8,  unit: 'porsiyon', is_vegetarian: true, preparation_time: 15 },

    // ── Etler & Kebaplar ──────────────────────────────────────────────────────
    { category_id: c['Etler & Kebaplar'],  name: 'Adana Kebap',         price: 110, cost: 35, tax: 8,  unit: 'porsiyon', is_spicy: true,   preparation_time: 18 },
    { category_id: c['Etler & Kebaplar'],  name: 'Urfa Kebap',          price: 105, cost: 33, tax: 8,  unit: 'porsiyon', is_spicy: false,  preparation_time: 18 },
    { category_id: c['Etler & Kebaplar'],  name: 'Şiş Kebap',           price: 125, cost: 40, tax: 8,  unit: 'porsiyon', preparation_time: 20 },
    { category_id: c['Etler & Kebaplar'],  name: 'Döner',               price: 85,  cost: 25, tax: 8,  unit: 'porsiyon', preparation_time: 8  },

    // ── Balık & Deniz ─────────────────────────────────────────────────────────
    { category_id: c['Balık & Deniz'],     name: 'Levrek Izgara',       price: 150, cost: 50, tax: 8,  unit: 'porsiyon', preparation_time: 20 },
    { category_id: c['Balık & Deniz'],     name: 'Çipura Izgara',       price: 160, cost: 55, tax: 8,  unit: 'porsiyon', preparation_time: 20 },
    { category_id: c['Balık & Deniz'],     name: 'Karides Güveç',       price: 145, cost: 45, tax: 8,  unit: 'porsiyon', preparation_time: 15 },

    // ── Tatlılar ──────────────────────────────────────────────────────────────
    { category_id: c['Tatlılar'],          name: 'Baklava',             price: 55,  cost: 15, tax: 8,  unit: 'porsiyon', is_vegetarian: true, preparation_time: 3 },
    { category_id: c['Tatlılar'],          name: 'Künefe',              price: 65,  cost: 18, tax: 8,  unit: 'porsiyon', is_vegetarian: true, preparation_time: 10 },
    { category_id: c['Tatlılar'],          name: 'Sütlaç',              price: 45,  cost: 10, tax: 8,  unit: 'porsiyon', is_vegetarian: true, preparation_time: 3 },

    // ── Kahveler ──────────────────────────────────────────────────────────────
    { category_id: c['Kahveler'],          name: 'Türk Kahvesi',        price: 30,  cost: 6,  tax: 8,  unit: 'fincan', preparation_time: 5 },
    { category_id: c['Kahveler'],          name: 'Espresso',            price: 25,  cost: 5,  tax: 8,  unit: 'fincan', preparation_time: 3 },
    { category_id: c['Kahveler'],          name: 'Cappuccino',          price: 45,  cost: 10, tax: 8,  unit: 'bardak', is_vegetarian: true, preparation_time: 4 },
    { category_id: c['Kahveler'],          name: 'Latte',               price: 50,  cost: 12, tax: 8,  unit: 'bardak', is_vegetarian: true, preparation_time: 4 },

    // ── Sıcak İçecekler ───────────────────────────────────────────────────────
    { category_id: c['Sıcak İçecekler'],   name: 'Çay',                 price: 15,  cost: 2,  tax: 8,  unit: 'bardak', is_vegan: true, preparation_time: 2 },
    { category_id: c['Sıcak İçecekler'],   name: 'Bitki Çayı',          price: 25,  cost: 4,  tax: 8,  unit: 'bardak', is_vegan: true, preparation_time: 3 },

    // ── Soğuk İçecekler ───────────────────────────────────────────────────────
    { category_id: c['Soğuk İçecekler'],   name: 'Kola',                price: 30,  cost: 8,  tax: 8,  unit: 'şişe', preparation_time: 1 },
    { category_id: c['Soğuk İçecekler'],   name: 'Ayran',               price: 20,  cost: 4,  tax: 8,  unit: 'bardak', is_vegetarian: true, preparation_time: 1 },
    { category_id: c['Soğuk İçecekler'],   name: 'Limonata',            price: 35,  cost: 8,  tax: 8,  unit: 'bardak', is_vegan: true, preparation_time: 3 },
    { category_id: c['Soğuk İçecekler'],   name: 'Su',                  price: 10,  cost: 2,  tax: 8,  unit: 'şişe', is_vegan: true, preparation_time: 1 },

    // ── Alkollü İçecekler ─────────────────────────────────────────────────────
    { category_id: c['Alkollü İçecekler'], name: 'Bira',                price: 55,  cost: 18, tax: 18, unit: 'şişe', preparation_time: 1 },
    { category_id: c['Alkollü İçecekler'], name: 'Kırmızı Şarap',       price: 120, cost: 35, tax: 18, unit: 'kadeh', preparation_time: 2 },
    { category_id: c['Alkollü İçecekler'], name: 'Beyaz Şarap',         price: 110, cost: 30, tax: 18, unit: 'kadeh', preparation_time: 2 },
  ]

  // Eksik ürünleri ekle (mevcut isimleri atla)
  const existingItems = await MenuItem.find().select('name').lean()
  const existingNames = new Set(existingItems.map(i => i.name))
  const newItems = items.filter(i => !existingNames.has(i.name))

  if (newItems.length > 0) {
    await MenuItem.insertMany(newItems)
    console.log(`  ✅ ${newItems.length} yeni ürün eklendi`)
  } else {
    console.log(`  ℹ️  Tüm ürünler zaten mevcut`)
  }
}

async function seedSettings() {
  const count = await Settings.countDocuments()
  if (count > 0) { console.log(`  ℹ️  Ayarlar zaten mevcut`); return }

  await Settings.create([
    { key: 'restaurant_name',  value: 'GastroSmart Restoran', type: 'string'  },
    { key: 'currency',         value: 'TRY',                  type: 'string'  },
    { key: 'currency_symbol',  value: '₺',                    type: 'string'  },
    { key: 'timezone',         value: 'Europe/Istanbul',       type: 'string'  },
    { key: 'receipt_footer',   value: 'Teşekkür ederiz! Tekrar bekleriz.', type: 'string' },
    { key: 'tax_rate',         value: 8,                       type: 'number'  },
    { key: 'theme',            value: {
        preset: 'dark',
        colors: {
          bg: '#0f1117', surface: '#161923', surface2: '#1e2235',
          border: '#2d3348', text: '#f0f2f8', textMuted: '#6b7280',
          accent: '#f59e0b', accentText: '#0f1117',
        },
        borderRadius: '12px',
        fontScale: '1',
      }, type: 'json' },
  ])
  console.log('  ✅ Varsayılan ayarlar oluşturuldu')
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Başka bir modülden çağrılabilir: MongoDB bağlantısı zaten açık varsayılır.
 */
async function runSeed({ verbose = true } = {}) {
  const log = verbose ? console.log : () => {}
  log('👤 Kullanıcılar...');  await seedUsers()
  log('🪑 Masalar...');       await seedTables()
  log('🍽️  Menü...');          await seedMenu()
  log('⚙️  Ayarlar...');       await seedSettings()
}

async function main() {
  console.log('\n🌱 GastroSmart POS — MongoDB Seed\n')
  console.log(`📡 Bağlanıyor: ${MONGO_URI.replace(/\/\/([^:]+:[^@]+)@/, '//***@')}\n`)

  await mongoose.connect(MONGO_URI)
  console.log('✅ MongoDB bağlandı\n')

  await runSeed()

  console.log('\n✅ Seed tamamlandı!')
  console.log('\n📝 Giriş bilgileri:')
  console.log('   admin   / admin123')
  console.log('   manager / manager123')
  console.log('   garson1 / garson123\n')
  console.log('⚠️  Şifreleri değiştirmeyi unutmayın!\n')
}

// CLI olarak çağrılırsa tam seed akışı
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('\n❌ Seed hatası:', err.message)
      process.exit(1)
    })
}

module.exports = { runSeed }
