import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/GastroSmart-Pos/' : '/',
  plugins: [
    react(),
    VitePWA({
      // 'prompt' kullanıcı bir şey yazarken zorla refresh atmaz; yeni
      // versiyon geldiğinde sadece kayıt edilir, kullanıcı sayfa kapatıp
      // açtığında yeni sürüm yüklenir. 'autoUpdate' ise form doluyken bile
      // page reload tetikleyebiliyordu.
      registerType: 'prompt',
      manifest: {
        name: 'GastroSmart POS',
        short_name: 'GastroSmart',
        description: 'Profesyonel Restoran Adisyon Sistemi',
        theme_color: '#0f1117',
        background_color: '#0f1117',
        display: 'standalone',
        orientation: 'landscape',
        scope: process.env.GITHUB_PAGES ? '/GastroSmart-Pos/' : '/',
        start_url: process.env.GITHUB_PAGES ? '/GastroSmart-Pos/' : '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: ({ request, url }: { request: Request; url: URL }) =>
              request.method === 'GET' && /\/api\//.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 86400 },
              networkTimeoutSeconds: 5
            }
          }
        ]
      },
      devOptions: { enabled: false }
    })
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  },
  server: {
    host: '0.0.0.0', hmr: { host: 'localhost' },
    port: 5173
  }
})
