const winston = require('winston')
const path = require('path')
const fs = require('fs')

// Logs klasörü oluştur
const logsDir = path.join(__dirname, '../../logs')
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

const logLevel = process.env.LOG_LEVEL || 'info'
const maxSize = process.env.LOG_MAX_SIZE || '10m'
const maxFiles = process.env.LOG_MAX_FILES || '14'

// Custom Format
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : ''
    const stackStr = stack ? `\n${stack}` : ''
    return `[${timestamp}] [${level.toUpperCase()}] ${message} ${metaStr}${stackStr}`
  })
)

// Console Transport
const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
      return `${timestamp} [${level}] ${message} ${metaStr}`
    })
  ),
})

// File Transport - Combined
const combinedFileTransport = new winston.transports.File({
  filename: path.join(logsDir, 'app.log'),
  format: customFormat,
  maxsize: maxSize,
  maxFiles: maxFiles,
})

// File Transport - Error (Hata dosyası)
const errorFileTransport = new winston.transports.File({
  filename: path.join(logsDir, 'error.log'),
  level: 'error',
  format: customFormat,
  maxsize: maxSize,
  maxFiles: maxFiles,
})

// Logger oluştur
const logger = winston.createLogger({
  level: logLevel,
  defaultMeta: { service: 'gastrosmart-backend' },
  transports: [
    consoleTransport,
    combinedFileTransport,
    errorFileTransport,
  ],
})

module.exports = logger
