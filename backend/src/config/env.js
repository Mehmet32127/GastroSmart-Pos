require('dotenv').config()

const WEAK_SECRETS = [
  'gastrosmart-jwt-secret-CHANGE-ME-in-production',
  'gastrosmart-refresh-CHANGE-ME-in-production',
  'gastrosmart-offline-queue-secret-change-me',
]

const env = {
  PORT: parseInt(process.env.PORT || '3001'),
  HOST: process.env.HOST || '0.0.0.0',

  JWT_SECRET: process.env.JWT_SECRET || 'gastrosmart-jwt-secret-CHANGE-ME-in-production',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'gastrosmart-refresh-CHANGE-ME-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  HMAC_SECRET: process.env.HMAC_SECRET || 'gastrosmart-offline-queue-secret-change-me',

  CORS_ORIGINS: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(s => s.trim()),

  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '5242880'),

  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '12'),
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '200'),
  AUTH_RATE_LIMIT_MAX: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '20'),

  SSL_CERT: process.env.SSL_CERT || './certs/cert.pem',
  SSL_KEY: process.env.SSL_KEY || './certs/key.pem',

  RESTAURANT_NAME: process.env.RESTAURANT_NAME || 'Restoranım',
  NODE_ENV: process.env.NODE_ENV || 'development',

  BACKUP_ENABLED:          process.env.BACKUP_ENABLED          || 'false',
  BACKUP_DIR:              process.env.BACKUP_DIR               || './backups',
  BACKUP_RETENTION_DAYS:   parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),

  MONITOR_ENABLED:         process.env.MONITOR_ENABLED         || 'false',
  MEMORY_USAGE_THRESHOLD:  process.env.MEMORY_USAGE_THRESHOLD  || '80',
}

// Production'da zayıf/default secretlara izin verme
if (env.NODE_ENV === 'production') {
  const bad = [env.JWT_SECRET, env.JWT_REFRESH_SECRET, env.HMAC_SECRET].filter(s => WEAK_SECRETS.includes(s))
  if (bad.length > 0) {
    console.error('FATAL: Production ortamında zayıf/default secret kullanılıyor!')
    console.error('JWT_SECRET, JWT_REFRESH_SECRET ve HMAC_SECRET değerlerini .env dosyasında güçlü rastgele değerlerle ayarlayın.')
    process.exit(1)
  }
}

module.exports = env
