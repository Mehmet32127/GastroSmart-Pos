import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initSentry } from './config/sentry'
import './index.css'

// Sentry — render'dan önce init edilmeli ki tüm hatalar yakalansın
initSentry()

// PWA Service Worker registration
// Davranış:
//   - confirm() blocking popup KULLANILMIYOR (her açılışta sıkıcı uyarı)
//   - Yeni versiyon arka planda indirilir
//   - Kullanıcıya küçük bir toast bildirimi: "Yeni sürüm hazır" + "Yenile" butonu
//   - Kullanıcı kapatırsa yeni SW "waiting" state'inde kalır
//   - Tarayıcı tamamen kapatılıp tekrar açıldığında otomatik aktif olur (SW lifecycle)
import { registerSW } from 'virtual:pwa-register'
import toast from 'react-hot-toast'

const updateSW = registerSW({
  onNeedRefresh() {
    toast(
      (t) => (
        // Sağ altta küçük kart — modal değil, kullanıcıyı engellemez
        // 30 saniye görünür, yenile butonuna basarsa anında uygular
        // basmazsa kapatınca toast kaybolur, yeni SW bir sonraki cold start'ta aktif
        // Bu, formda yazıyorsa veriyi kaybettirmez.
        // toast.dismiss(t.id) butonla kapatma
        // updateSW(true) → skipWaiting + reload
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
          React.createElement('div', null,
            React.createElement('div', { style: { fontWeight: 700, marginBottom: 2 } }, 'Yeni sürüm hazır'),
            React.createElement('div', { style: { fontSize: 12, opacity: 0.7 } }, 'Yenileyince son değişiklikler gelir'),
          ),
          React.createElement('button', {
            onClick: () => { updateSW(true); toast.dismiss(t.id) },
            style: {
              padding: '6px 12px',
              borderRadius: 8,
              background: '#F59E0B',
              color: '#0F1117',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 13,
            },
          }, 'Yenile'),
        )
      ),
      { duration: 30000, position: 'bottom-right' }
    )
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
