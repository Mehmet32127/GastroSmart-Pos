import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
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

// Uncaught promise rejection'ları console'a yaz — debug için izlenebilir
window.addEventListener('unhandledrejection', (event) => {
  console.error('🔴 Unhandled promise rejection:', event.reason)
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
