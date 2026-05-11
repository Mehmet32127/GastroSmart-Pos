import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserPreferences } from './useUserPreferences'

/**
 * Global klavye kısayolları.
 *
 * Aktif tuşlar:
 *   F1        → Masalar
 *   F2        → Siparişler
 *   F3        → Menü (yetkili rolse)
 *   F4        → Raporlar (yetkili)
 *   Ctrl+/    → Kısayol rehberi modal (ShortcutsModal)
 *   Ctrl+L    → Ekranı kilitle
 *   ESC       → Açık modal/panel kapat (component'lerin kendi handler'ı)
 *
 * Notlar:
 *   - input/textarea içindeyken tetiklenmez (kullanıcı yazıyordur)
 *   - prefs.shortcutsEnabled false ise hiç dinlemez (kullanıcı kapatabilir)
 *   - Tarayıcı default'larını ezer (preventDefault) — F1 help sayfası açmasın
 */

interface ShortcutHandlers {
  onShowShortcuts?: () => void
  onLock?: () => void
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers = {}) {
  const navigate = useNavigate()
  const { prefs } = useUserPreferences()

  useEffect(() => {
    if (!prefs.shortcutsEnabled) return

    const handler = (e: KeyboardEvent) => {
      // Input/textarea içinde tetikleme — kullanıcı yazıyor olabilir
      const target = e.target as HTMLElement
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
        // Ctrl+/ yine de çalışsın (modal açar)
        if (!(e.ctrlKey && e.key === '/')) return
      }

      // Ctrl+/ → kısayol rehberi
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault()
        handlers.onShowShortcuts?.()
        return
      }

      // Ctrl+L → kilit
      if (e.ctrlKey && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        handlers.onLock?.()
        return
      }

      // F-tuşları ile sayfa geçişleri
      switch (e.key) {
        case 'F1':
          e.preventDefault()
          navigate('/')
          break
        case 'F2':
          e.preventDefault()
          navigate('/orders')
          break
        case 'F3':
          e.preventDefault()
          navigate('/menu')
          break
        case 'F4':
          e.preventDefault()
          navigate('/reports')
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [prefs.shortcutsEnabled, handlers, navigate])
}

// Modal'da göstermek için kısayol listesi
export const SHORTCUTS_LIST = [
  { key: 'F1',     label: 'Masalar sayfasına git' },
  { key: 'F2',     label: 'Siparişler sayfasına git' },
  { key: 'F3',     label: 'Menü sayfasına git (yetki gerekir)' },
  { key: 'F4',     label: 'Raporlar sayfasına git (yetki gerekir)' },
  { key: 'Ctrl + L', label: 'Ekranı kilitle' },
  { key: 'Ctrl + /', label: 'Bu rehberi aç/kapa' },
  { key: 'ESC',    label: 'Açık modal/paneli kapat' },
]
