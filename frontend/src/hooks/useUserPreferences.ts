import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { usePreferencesStore, getEffectiveTheme } from '@/store/preferencesStore'
import { useThemeStore } from '@/store/themeStore'
import toast from 'react-hot-toast'
import type { UserPreferences } from '@/types'

// Light mode'da kaldırılacak inline style property'ler.
// themeStore restoran teması için bunları inline koyar, ama inline styles
// CSS selector'lerini override eder — kullanıcı light seçince CSS
// [data-theme="light"] cascade'i çalışmaz. Light mode'da bu inline'lar
// kaldırılır, dark'a dönünce themeStore.applyTheme() ile geri konur.
// Accent (--color-accent, --color-accent-text) restoran marka rengi olduğu
// için her iki modda korunur, sadece bg/surface/text alanları temizlenir.
const LIGHT_OVERRIDE_PROPS = [
  '--color-bg',
  '--color-surface',
  '--color-surface2',
  '--color-border',
  '--color-text',
  '--color-text-muted',
]

/**
 * Kişisel UI tercihleri hook'u — Zustand store wrapper.
 *
 * v2: Local useState'ten Zustand'a taşındı. Tüm component'ler aynı state'i
 * okur, race condition yok.
 *
 * - Backend'den /me ile gelen prefs → store'a sync edilir
 * - Kullanıcı değiştirdiğinde → optimistic update + backend PATCH
 * - localStorage'a otomatik persist
 * - data-theme attribute HTML root'a otomatik uygulanır
 */
export function useUserPreferences() {
  const user = useAuthStore((s) => s.user)
  const prefs = usePreferencesStore((s) => s.prefs)
  const setPrefs = usePreferencesStore((s) => s.setPrefs)
  const updatePrefs = usePreferencesStore((s) => s.updatePrefs)

  // /me sonrası gelen backend preferences'ı store'a yerleştir
  useEffect(() => {
    if (user?.preferences) setPrefs(user.preferences)
  }, [user?.preferences, setPrefs])

  const effectiveTheme = getEffectiveTheme(prefs.theme)

  // HTML'e data-theme attribute uygula + themeStore çakışmasını çöz.
  // BUG FIX: themeStore inline --color-bg vb. set ediyordu → CSS [data-theme="light"]
  // override edemiyordu → light mode hiç görünmüyordu. Light'ta inline'ları kaldır,
  // CSS cascade çalışsın; Dark'a dönünce themeStore'u tekrar uygula.
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = effectiveTheme
    if (effectiveTheme === 'light') {
      LIGHT_OVERRIDE_PROPS.forEach((p) => root.style.removeProperty(p))
    } else {
      useThemeStore.getState().applyTheme()
    }
  }, [effectiveTheme])

  // System mode → OS değişimi (prefers-color-scheme) gerçek zamanlı yakala
  useEffect(() => {
    if (prefs.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const handler = () => {
      document.documentElement.dataset.theme = mq.matches ? 'light' : 'dark'
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [prefs.theme])

  const update = async (patch: Partial<UserPreferences>) => {
    const success = await updatePrefs(patch)
    if (!success) toast.error('Tercihler kaydedilemedi')
  }

  return {
    prefs,
    effectiveTheme,
    setTheme:        (theme: UserPreferences['theme']) => update({ theme }),
    setAccent:       (accentColor: string | null) => update({ accentColor }),
    toggleSound:     () => update({ soundEnabled: !prefs.soundEnabled }),
    toggleShortcuts: () => update({ shortcutsEnabled: !prefs.shortcutsEnabled }),
  }
}
