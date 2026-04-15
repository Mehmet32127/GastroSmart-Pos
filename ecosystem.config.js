/**
 * GastroSmart POS — PM2 Ecosystem Configuration
 *
 * Kullanım:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 monit
 *   pm2 logs gastrosmart-backend
 *   pm2 restart gastrosmart-backend
 */

module.exports = {
  apps: [
    {
      name:      'gastrosmart-backend',
      script:    './backend/server.js',
      cwd:       './backend',
      watch:     false,
      instances: 1,
      exec_mode: 'fork',

      env_production: {
        NODE_ENV: 'production',
        PORT:     3001,
      },

      max_restarts:        10,
      min_uptime:          '10s',
      kill_timeout:        5000,
      listen_timeout:      3000,
      autorestart:         true,
      max_memory_restart:  '1G',
      node_args:           '--max-old-space-size=512',

      error_file:      './logs/pm2-error.log',
      out_file:        './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
}
