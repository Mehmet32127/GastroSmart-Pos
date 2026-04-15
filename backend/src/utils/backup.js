/**
 * GastroSmart POS — Backup Utility (MongoDB)
 *
 * Strateji:
 *  - `mongodump` binary varsa → gerçek BSON dump alır (tam yedek)
 *  - Yoksa (Railway, Atlas vb.) → kritik koleksiyonları JSON olarak export eder
 *
 * Atlas kullananlar için not:
 *  Atlas kendi otomatik yedeğini alır. Bu utility ek/elle yedek içindir.
 */

const fs      = require('fs')
const path    = require('path')
const { execFileSync } = require('child_process')
const mongoose     = require('mongoose')
const logger       = require('./logger')

const BACKUP_DIR     = process.env.BACKUP_DIR || path.join(__dirname, '../../backups')
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS) || 30

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
  }
}

/** mongodump binary'nin mevcut olup olmadığını kontrol eder. */
function hasMongodump() {
  try {
    execFileSync('mongodump', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * Kritik koleksiyonları JSON olarak yedekler.
 * mongodump yokken (Railway, Render vb.) kullanılır.
 */
async function exportCollectionsToJson(outDir) {
  const collections = ['users', 'tables', 'categories', 'menuitems', 'orders', 'reservations', 'settings', 'cashcloses']
  let exported = 0

  for (const col of collections) {
    try {
      const docs = await mongoose.connection.collection(col).find({}).toArray()
      const filePath = path.join(outDir, `${col}.json`)
      fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf8')
      exported++
    } catch {
      // Koleksiyon yoksa sessizce geç
    }
  }

  return exported
}

// ── Ana backup fonksiyonu ─────────────────────────────────────────────────────

async function backupDatabase() {
  try {
    ensureBackupDir()

    const timestamp  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const backupName = `gastrosmart_backup_${timestamp}`
    const outDir     = path.join(BACKUP_DIR, backupName)
    fs.mkdirSync(outDir, { recursive: true })

    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gastrosmart'

    if (hasMongodump()) {
      // ── mongodump path ────────────────────────────────────────────────────
      execFileSync('mongodump', ['--uri', mongoUri, '--out', outDir], { stdio: 'pipe' })
      logger.info(`✅ mongodump backup tamamlandı: ${backupName}`)
    } else {
      // ── JSON export path ──────────────────────────────────────────────────
      const count = await exportCollectionsToJson(outDir)
      logger.info(`✅ JSON backup tamamlandı: ${backupName} (${count} koleksiyon)`)
    }

    cleanOldBackups()
    return { success: true, name: backupName, path: outDir }
  } catch (err) {
    logger.error(`❌ Backup hatası: ${err.message}`)
    return { success: false, error: err.message }
  }
}

// ── Manuel backup (API endpoint için) ────────────────────────────────────────

async function createManualBackup(description = '') {
  try {
    ensureBackupDir()

    const timestamp   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const sanitized   = description.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32)
    const backupName  = `gastrosmart_manual_${sanitized ? sanitized + '_' : ''}${timestamp}`
    const outDir      = path.join(BACKUP_DIR, backupName)
    fs.mkdirSync(outDir, { recursive: true })

    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gastrosmart'

    if (hasMongodump()) {
      execFileSync('mongodump', ['--uri', mongoUri, '--out', outDir], { stdio: 'pipe' })
    } else {
      await exportCollectionsToJson(outDir)
    }

    const sizeBytes = getDirSize(outDir)
    const sizeInMB  = (sizeBytes / (1024 * 1024)).toFixed(2)
    logger.info(`✅ Manuel backup oluşturuldu: ${backupName} (${sizeInMB} MB)`)

    return { success: true, filename: backupName, path: outDir, size: sizeBytes, sizeInMB }
  } catch (err) {
    logger.error(`❌ Manuel backup hatası: ${err.message}`)
    return { success: false, error: err.message }
  }
}

// ── Restore ───────────────────────────────────────────────────────────────────

async function restoreBackup(backupName) {
  try {
    const backupPath = path.join(BACKUP_DIR, backupName)
    if (!fs.existsSync(backupPath)) {
      logger.error(`❌ Backup bulunamadı: ${backupName}`)
      return false
    }

    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gastrosmart'

    if (hasMongodump()) {
      execFileSync('mongorestore', ['--uri', mongoUri, '--drop', backupPath], { stdio: 'pipe' })
      logger.info(`✅ mongorestore tamamlandı: ${backupName}`)
      return true
    }

    // JSON restore: her koleksiyonu temizle ve yeniden yükle
    const files = fs.readdirSync(backupPath).filter(f => f.endsWith('.json'))
    for (const file of files) {
      const colName = path.basename(file, '.json')
      const docs    = JSON.parse(fs.readFileSync(path.join(backupPath, file), 'utf8'))
      const col     = mongoose.connection.collection(colName)
      await col.deleteMany({})
      if (docs.length > 0) await col.insertMany(docs)
      logger.info(`  ↩️  ${colName}: ${docs.length} döküman restore edildi`)
    }

    logger.info(`✅ JSON restore tamamlandı: ${backupName}`)
    return true
  } catch (err) {
    logger.error(`❌ Restore hatası: ${err.message}`)
    return false
  }
}

// ── Backup listesi ────────────────────────────────────────────────────────────

function listBackups() {
  try {
    ensureBackupDir()

    return fs.readdirSync(BACKUP_DIR)
      .filter(name => name.startsWith('gastrosmart_') && fs.statSync(path.join(BACKUP_DIR, name)).isDirectory())
      .map(name => {
        const dirPath   = path.join(BACKUP_DIR, name)
        const stats     = fs.statSync(dirPath)
        const sizeBytes = getDirSize(dirPath)
        return {
          filename:  name,
          size:      sizeBytes,
          sizeInMB:  (sizeBytes / (1024 * 1024)).toFixed(2),
          created:   stats.mtime.toISOString(),
          isManual:  name.includes('_manual_'),
        }
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created))
  } catch (err) {
    logger.error(`❌ Backup listesi hatası: ${err.message}`)
    return []
  }
}

// ── Yardımcılar ───────────────────────────────────────────────────────────────

function getDirSize(dirPath) {
  if (!fs.existsSync(dirPath)) return 0
  return fs.readdirSync(dirPath).reduce((total, file) => {
    const filePath = path.join(dirPath, file)
    const stats    = fs.statSync(filePath)
    return total + (stats.isDirectory() ? getDirSize(filePath) : stats.size)
  }, 0)
}

function cleanOldBackups() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return
    const now = Date.now()

    fs.readdirSync(BACKUP_DIR).forEach(name => {
      const dirPath   = path.join(BACKUP_DIR, name)
      const stats     = fs.statSync(dirPath)
      const ageInDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24)

      if (ageInDays > RETENTION_DAYS) {
        fs.rmSync(dirPath, { recursive: true, force: true })
        logger.info(`🗑️  Eski backup silindi: ${name}`)
      }
    })
  } catch (err) {
    logger.error(`❌ Eski backup temizleme hatası: ${err.message}`)
  }
}

function ensureBackupDirExport() {
  ensureBackupDir()
}

module.exports = {
  backupDatabase,
  createManualBackup,
  restoreBackup,
  listBackups,
  cleanOldBackups,
  ensureBackupDir: ensureBackupDirExport,
}
