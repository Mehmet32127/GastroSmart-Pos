const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')
const express = require('express')
const { Server } = require('socket.io')
const helmet = require('helmet')
const cors = require('cors')
const rateLimit = require('express-rate-limit')
const cron = require('node-cron')

const logger = require('./src/utils/logger')
const { httpLogger } = require('./src/middleware/morganMiddleware')
const env = require('./src/config/env')
const { connectDatabase } = require('./src/config/mongodb')
const { setupSocket } = require('./src/socket/socketHandler')
const { errorHandler } = require('./src/middleware/errorHandler')
const { cleanExpiredTokens } = require('./src/utils/jwt')
const { backupDatabase } = require('./src/utils/backup')

const app = express()

logger.info('🚀 GastroSmart POS Backend başlatılıyor...')

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }))
app.use(httpLogger)

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || env.NODE_ENV === 'development') {
      callback(null, true)
    } else if (env.CORS_ORIGINS.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('CORS engeli: ' + origin))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

const globalLimit = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Cok fazla istek. Lutfen bekleyin.' },
})

const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.AUTH_RATE_LIMIT_MAX,
  message: { success: false, error: 'Cok fazla giris denemesi. 15 dakika bekleyin.' },
})

const backupLimit = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 saat
  max: 10,
  message: { success: false, error: 'Cok fazla backup/restore istegi. 1 saat sonra tekrar deneyin.' },
  standardHeaders: true,
  legacyHeaders: false,
})

app.use('/api', globalLimit)
app.use('/api/auth/login', authLimit)
app.use('/api/backup', backupLimit)

const uploadsDir = path.resolve(env.UPLOAD_DIR)
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
app.use(express.static(path.join(__dirname, 'public')))
app.use('/uploads', express.static(uploadsDir))

app.use((req, _res, next) => {
  req.io = app.get('io')
  next()
})

app.use('/api/auth',         require('./src/routes/auth'))
app.use('/api/tables',       require('./src/routes/tables'))
app.use('/api/orders',       require('./src/routes/orders'))
app.use('/api/menu',         require('./src/routes/menu'))
app.use('/api/reservations', require('./src/routes/reservations'))
app.use('/api/reports',      require('./src/routes/reports'))
app.use('/api/users',        require('./src/routes/users'))
app.use('/api/settings',     require('./src/routes/settings'))
app.use('/api/sync',         require('./src/routes/sync'))
app.use('/api/print',        require('./src/routes/print'))
app.use('/api/backup',       require('./src/routes/backup'))

app.get('/api/health', (req, res) => {
  const used = process.memoryUsage()
  const uptime = process.uptime()
  const os = require('os')
  
  res.json({
    success: true,
    status: 'ok',
    app: 'gastrosmart-pos',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(uptime),
    memory: {
      rss: Math.round(used.rss / 1024 / 1024),
      heapTotal: Math.round(used.heapTotal / 1024 / 1024),
      heapUsed: Math.round(used.heapUsed / 1024 / 1024),
      heapUsedPercent: ((used.heapUsed / used.heapTotal) * 100).toFixed(2)
    },
    cpu: {
      cores: os.cpus().length,
      loadAverage: os.loadavg()
    },
    database: {
      connected: true
    }
  })
})

// 404 for unknown API endpoints
app.use('/api', (_req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint bulunamadı' })
})

// SPA fallback — serve index.html for all non-API routes
app.get('*', (req, res, next) => {
  const indexPath = path.join(__dirname, 'public', 'index.html')
  res.sendFile(indexPath, (err) => {
    if (err) next(err)
  })
})

app.use(errorHandler)

// HTTPS varsa kullan, yoksa HTTP ile devam et
const certPath = path.resolve(env.SSL_CERT)
const keyPath  = path.resolve(env.SSL_KEY)

let server
if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  const credentials = {
    cert: fs.readFileSync(certPath),
    key:  fs.readFileSync(keyPath),
  }
  server = https.createServer(credentials, app)
  console.log('[SERVER] HTTPS modu aktif')
} else {
  server = http.createServer(app)
  console.log('[SERVER] HTTP modu (gelistirme icin)')
  console.log('[SERVER] Sertifika olusturmak icin: node scripts/generate-certs.js')
}

const io = new Server(server, {
  cors: {
    origin: env.NODE_ENV === 'development' ? '*' : env.CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,      // 60 saniye - network latency'ye tolerans
  pingInterval: 25000,     // 25 saniye - timeout'ten kısa olmalı
  upgradeTimeout: 10000,
  maxHttpBufferSize: 1e6,  // 1MB
  serveClient: false,
})

setupSocket(io)
app.set('io', io)

// Connect to MongoDB
connectDatabase()
// cleanExpiredTokens: MongoDB TTL index hallediyor, gereksiz interval kaldırıldı

server.listen(env.PORT, env.HOST, () => {
  const protocol = fs.existsSync(certPath) && fs.existsSync(keyPath) ? 'https' : 'http'
  const os = require('os')
  const nets = os.networkInterfaces()
  const localIPs = []

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        localIPs.push(net.address)
      }
    }
  }

  console.log('\n╔════════════════════════════════════════╗')
  console.log('║        GastroSmart POS Backend          ║')
  console.log('╚════════════════════════════════════════╝')
  console.log(`\n✅ Sunucu calisiyor: ${protocol}://localhost:${env.PORT}`)
  if (localIPs.length > 0) {
    console.log('\n📱 Tablet/telefon baglantisi icin:')
    localIPs.forEach(ip => {
      console.log(`   ${protocol}://${ip}:${env.PORT}`)
    })
  }
  if (env.NODE_ENV !== 'production') {
    console.log('\n📖 Varsayilan giris:')
    console.log('   Kullanici: admin')
    console.log('   Sifre:     admin123')
    console.log('\n⚠️  Sifreyi degistirmeyi unutmayin!\n')
  }
  
  // ─── Otomatik Database Backup ────────────────────────────────────────────
  if (env.BACKUP_ENABLED === 'true') {
    logger.info('📦 Otomatik database backup etkinleştirildi')
    // Her gün 23:00'de backup al (production schedule: 0 23 * * *)
    const backupSchedule = process.env.BACKUP_SCHEDULE || '0 23 * * *'
    cron.schedule(backupSchedule, () => {
      logger.info('⏰ Zamanlanmış database backup başlatılıyor...')
      backupDatabase()
    })
    // İlk backup'i 5 dakika sonra al
    setTimeout(() => backupDatabase(), 5 * 60 * 1000)
  }
  
  // ─── Sistem Monitoring ────────────────────────────────────────────────────
  if (env.MONITOR_ENABLED === 'true') {
    const memThreshold = parseInt(env.MEMORY_USAGE_THRESHOLD) || 80
    setInterval(() => {
      const used = process.memoryUsage()
      const heapUsedPercent = (used.heapUsed / used.heapTotal) * 100
      
      if (heapUsedPercent > memThreshold) {
        logger.warn(`⚠️  Yüksek bellek kullanımı: ${heapUsedPercent.toFixed(2)}%`)
      }
    }, 5 * 60 * 1000) // Her 5 dakikada bir kontrol et
  }
})

process.on('SIGTERM', () => { 
  logger.info('SIGTERM sinyali alındı, sunucu kapatılıyor...')
  server.close(() => {
    logger.info('Sunucu başarıyla kapatıldı')
    process.exit(0)
  })
})
process.on('SIGINT',  () => { 
  logger.info('SIGINT sinyali alındı, sunucu kapatılıyor...')
  server.close(() => {
    logger.info('Sunucu başarıyla kapatıldı')
    process.exit(0)
  })
})
