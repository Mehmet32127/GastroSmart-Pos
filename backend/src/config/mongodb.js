const mongoose = require('mongoose')
const logger = require('../utils/logger')

/**
 * MongoDB Connection Setup
 */
async function connectDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gastrosmart'

    logger.info(`🗄️  MongoDB baglanıyor: ${mongoUri.split('@')[1] || 'localhost'}`)

    await mongoose.connect(mongoUri, {
      maxPoolSize:     10,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 10000,
    })

    logger.info('✅ MongoDB baglandı başarıyla')

    // Otomatik seed: DB boşsa (ilk kurulum) ya da eksik varsayılan veri varsa doldur
    try {
      const { runSeed } = require('../../scripts/seed-mongodb')
      await runSeed({ verbose: false })
      logger.info('🌱 Veritabanı hazır (seed tamamlandı)')
    } catch (seedErr) {
      logger.warn(`⚠️  Auto-seed atlandı: ${seedErr.message}`)
    }

    // Connection events
    mongoose.connection.on('disconnected', () => {
      logger.warn('⚠️  MongoDB baglantısı koptu')
    })

    mongoose.connection.on('error', (err) => {
      logger.error(`❌ MongoDB hatası: ${err.message}`)
    })

    return mongoose.connection
  } catch (err) {
    logger.error(`❌ MongoDB baglantı hatası: ${err.message}`)
    process.exit(1)
  }
}

/**
 * Disconnect from MongoDB
 */
async function disconnectDatabase() {
  try {
    await mongoose.disconnect()
    logger.info('✅ MongoDB baglantısı kapatıldı')
  } catch (err) {
    logger.error(`Disconnect hatası: ${err.message}`)
  }
}

module.exports = {
  connectDatabase,
  disconnectDatabase,
  mongoose,
}
