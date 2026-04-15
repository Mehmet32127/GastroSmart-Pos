import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './index.css'

// PWA Service Worker registration
import { registerSW } from 'virtual:pwa-register'

const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('Yeni bir güncelleme mevcut. Yenile?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('GastroSmart offline moda hazır ✓')
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
