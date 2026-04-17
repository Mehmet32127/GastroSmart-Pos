const { app, BrowserWindow, shell, Tray, Menu, nativeImage, ipcMain } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const http = require('http')
const crypto = require('crypto')

// ── Kalıcı secret'lar — her restart'ta aynı kalır ─────────────────────────────
function loadOrCreateSecrets(secretsFile) {
  try {
    if (fs.existsSync(secretsFile)) {
      return JSON.parse(fs.readFileSync(secretsFile, 'utf8'))
    }
  } catch {}
  const secrets = {
    JWT_SECRET:         crypto.randomBytes(32).toString('hex'),
    JWT_REFRESH_SECRET: crypto.randomBytes(32).toString('hex'),
    HMAC_SECRET:        crypto.randomBytes(16).toString('hex'),
  }
  fs.writeFileSync(secretsFile, JSON.stringify(secrets, null, 2))
  return secrets
}

// ── Tek instance zorla — ikinci açılışta mevcut pencereyi öne getir ───────────
const gotSingleLock = app.requestSingleInstanceLock()
if (!gotSingleLock) {
  app.quit()
  process.exit(0)
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }
})

// ── Paths ─────────────────────────────────────────────────────────────────────
const isDev     = !app.isPackaged
const userDataDir = app.getPath('userData')
const dbDir     = path.join(userDataDir, 'db')
const logsDir   = path.join(userDataDir, 'logs')

// MongoDB binary: geliştirmede electron/mongodb/, pakette resources/mongodb/
const mongodBin = isDev
  ? path.join(__dirname, 'mongodb', 'mongod.exe')
  : path.join(process.resourcesPath, 'mongodb', 'mongod.exe')

// Backend: geliştirmede ../backend/, pakette resources/backend/
const backendDir = isDev
  ? path.join(__dirname, '..', 'backend')
  : path.join(process.resourcesPath, 'backend')

// Secret'lar userData'da kalıcı — restart'ta değişmez
const SECRETS = loadOrCreateSecrets(path.join(userDataDir, 'secrets.json'))

const PORT      = 3001
const MONGO_URI = `mongodb://127.0.0.1:27017/gastrosmart`

let mongodProcess  = null
let backendProcess = null
let mainWindow     = null
let tray           = null
let isQuitting     = false

// ── Yardımcılar ───────────────────────────────────────────────────────────────
function ensureDirs() {
  [dbDir, logsDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }) })
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  process.stdout.write(line)
  try { fs.appendFileSync(path.join(logsDir, 'electron.log'), line) } catch {}
}

function waitForPort(port, retries = 30, delay = 1000) {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const check = () => {
      const req = http.get(`http://127.0.0.1:${port}/api/health`, res => {
        if (res.statusCode === 200) { resolve(); return }
        retry()
      })
      req.on('error', retry)
      req.setTimeout(800, () => { req.destroy(); retry() })
    }
    const retry = () => {
      if (++attempts >= retries) return reject(new Error(`Port ${port} açılmadı`))
      setTimeout(check, delay)
    }
    check()
  })
}

// ── Loading penceresi ─────────────────────────────────────────────────────────
function createLoadingWindow() {
  const win = new BrowserWindow({
    width: 420, height: 280,
    frame: false, resizable: false, center: true,
    backgroundColor: '#0f1117',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  })
  win.loadFile(path.join(__dirname, 'loading.html'))
  return win
}

// ── Yazıcı IPC ────────────────────────────────────────────────────────────────
// ── Tray ikonunu URL'den güncelle (Ayarlar → Logo yükle) ─────────────────────
ipcMain.handle('tray:update-icon', async (_event, logoUrl) => {
  if (!tray) return
  try {
    const https = logoUrl.startsWith('https') ? require('https') : require('http')
    await new Promise((resolve, reject) => {
      https.get(logoUrl, (res) => {
        const chunks = []
        res.on('data', d => chunks.push(d))
        res.on('end', () => {
          try {
            const buf = Buffer.concat(chunks)
            const img = nativeImage.createFromBuffer(buf)
            if (!img.isEmpty()) {
              const resized = img.resize({ width: 16, height: 16 })
              tray.setImage(resized)
            }
            resolve()
          } catch (e) { reject(e) }
        })
        res.on('error', reject)
      }).on('error', reject)
    })
  } catch (e) {
    log(`[tray] İkon güncellenemedi: ${e.message}`)
  }
})

ipcMain.handle('printers:list', async () => {
  try {
    const printers = await mainWindow.webContents.getPrintersAsync()
    return printers.map(p => ({ name: p.name, isDefault: p.isDefault, status: p.status }))
  } catch {
    return []
  }
})

ipcMain.handle('print:receipt', async (_event, { html, printerName, paperWidth }) => {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    })

    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

    win.webContents.once('did-finish-load', () => {
      const width  = paperWidth === '58mm' ? 58 : 80   // mm
      win.webContents.print(
        {
          silent:           true,
          printBackground:  true,
          deviceName:       printerName || '',
          pageSize:         { width: width * 1000, height: 297 * 1000 },  // µm
          margins:          { marginType: 'none' },
        },
        (success, errType) => {
          win.destroy()
          resolve({ success, error: errType || null })
        },
      )
    })
  })
})

// ── Ana pencere ───────────────────────────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800,
    minWidth: 800, minHeight: 600,
    show: false,
    title: 'GastroSmart POS',
    backgroundColor: '#0f1117',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  mainWindow.loadURL(`http://127.0.0.1:${PORT}`)
  mainWindow.once('ready-to-show', () => mainWindow.show())

  // Harici linkleri tarayıcıda aç
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('close', e => {
    if (!isQuitting) { e.preventDefault(); mainWindow.hide() }
  })
}

// ── Sistem tepsisi ────────────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png')
  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createEmpty()

  tray = new Tray(icon)
  tray.setToolTip('GastroSmart POS')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Aç',   click: () => { mainWindow?.show(); mainWindow?.focus() } },
    { type: 'separator' },
    { label: 'Çıkış', click: () => { isQuitting = true; app.quit() } },
  ]))
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus() })
}

// ── MongoDB başlat ────────────────────────────────────────────────────────────
function startMongoDB() {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(mongodBin)) {
      return reject(new Error('mongod.exe bulunamadı: ' + mongodBin))
    }

    log(`MongoDB başlatılıyor: ${mongodBin}`)
    mongodProcess = spawn(mongodBin, [
      '--dbpath', dbDir,
      '--port',   '27017',
      '--bind_ip', '127.0.0.1',
      '--quiet',
    ], { stdio: 'pipe' })

    mongodProcess.stdout.on('data', d => log(`[mongo] ${d.toString().trim()}`))
    mongodProcess.stderr.on('data', d => log(`[mongo-err] ${d.toString().trim()}`))
    mongodProcess.on('error', err => reject(err))

    // MongoDB'nin hazır olmasını bekle
    let ready = false
    const timeout = setTimeout(() => {
      if (!ready) reject(new Error('MongoDB zaman aşımı'))
    }, 20000)

    const check = setInterval(() => {
      const client = http.get('http://127.0.0.1:27017', () => {})
      client.on('error', () => {}) // bekliyoruz
    }, 500)

    // Daha basit: 3 saniye bekle
    setTimeout(() => {
      clearInterval(check)
      clearTimeout(timeout)
      ready = true
      log('MongoDB hazır')
      resolve()
    }, 3000)
  })
}

// ── Backend başlat ────────────────────────────────────────────────────────────
function startBackend() {
  return new Promise((resolve, reject) => {
    const serverJs = path.join(backendDir, 'server.js')
    if (!fs.existsSync(serverJs)) {
      return reject(new Error('server.js bulunamadı: ' + serverJs))
    }

    log(`Backend başlatılıyor: ${serverJs}`)

    const env = {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',  // Electron binary'yi Node.js olarak çalıştır
      NODE_ENV:    'production',
      PORT:        String(PORT),
      MONGODB_URI: MONGO_URI,
      JWT_SECRET:          SECRETS.JWT_SECRET,
      JWT_REFRESH_SECRET:  SECRETS.JWT_REFRESH_SECRET,
      HMAC_SECRET:         SECRETS.HMAC_SECRET,
      BCRYPT_ROUNDS: '12',
      RATE_LIMIT_WINDOW_MS: '900000',
      RATE_LIMIT_MAX: '500',
      AUTH_RATE_LIMIT_MAX: '50',
      CORS_ORIGINS: `http://127.0.0.1:${PORT}`,
      UPLOAD_DIR:  path.join(userDataDir, 'uploads'),
      BACKUP_DIR:  path.join(userDataDir, 'backups'),
      LOG_FILE:    path.join(logsDir, 'app.log'),
    }

    backendProcess = spawn(process.execPath, [serverJs], {
      cwd: backendDir,
      env,
      stdio: 'pipe',
    })

    backendProcess.stdout.on('data', d => log(`[backend] ${d.toString().trim()}`))
    backendProcess.stderr.on('data', d => log(`[backend-err] ${d.toString().trim()}`))
    backendProcess.on('error', err => reject(err))
    backendProcess.on('exit', code => {
      if (code !== 0 && !isQuitting) log(`Backend beklenmedik çıkış: ${code}`)
    })

    waitForPort(PORT).then(resolve).catch(reject)
  })
}

// ── Temizlik ──────────────────────────────────────────────────────────────────
function killProcesses() {
  [backendProcess, mongodProcess].forEach(p => {
    if (p && !p.killed) { try { p.kill('SIGTERM') } catch {} }
  })
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // File/Edit/View/Window/Help menü çubuğunu kaldır
  Menu.setApplicationMenu(null)

  ensureDirs()
  createTray()

  const loader = createLoadingWindow()

  try {
    log('MongoDB başlatılıyor...')
    await startMongoDB()

    log('Backend başlatılıyor...')
    await startBackend()

    log('Uygulama hazır.')
    loader.close()
    createMainWindow()
  } catch (err) {
    log(`HATA: ${err.message}`)
    loader.close()

    const { dialog } = require('electron')
    dialog.showErrorBox('GastroSmart POS — Başlatma Hatası', err.message)
    app.quit()
  }
})

app.on('window-all-closed', e => e.preventDefault()) // Tray'de kalır

app.on('before-quit', () => {
  isQuitting = true
  if (tray) { tray.destroy(); tray = null }
  killProcesses()
})

app.on('will-quit', () => {
  if (tray) { tray.destroy(); tray = null }
  killProcesses()
})
