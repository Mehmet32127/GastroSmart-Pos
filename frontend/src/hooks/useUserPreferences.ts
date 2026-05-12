import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { usePreferencesStore, getEffectiveTheme } from '@/store/preferencesStore'
import toast from 'react-hot-toast'
import type { UserPreferences } from '@/types'

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

  // HTML'e data-theme attribute uygula (CSS variables bunu okur)
  useEffect(() => {
    document.documentElement.dataset.theme = effectiveTheme
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
