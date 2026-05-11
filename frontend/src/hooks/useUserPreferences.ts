import { useState, useCallback, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/api/auth'
import type { UserPreferences } from '@/types'
import toast from 'react-hot-toast'

/**
 * Kişisel UI tercihleri hook'u.
 *
 * Davranış:
 *   - Mount'ta authStore'daki user.preferences değerlerini okur
 *   - Optimistic update: önce local state güncellenir, sonra backend
 *   - Hata olursa toast + rollback
 *   - localStorage'a da yedek yaz (offline'da çalışsın)
 *
 * theme: 'system' → tarayıcı/OS tercihini takip eder (prefers-color-scheme)
 */

const DEFAULT_PREFS: UserPreferences = {
  theme:            'system',
  accentColor:      null,
  soundEnabled:     true,
  shortcutsEnabled: true,
}

const STORAGE_KEY = 'gastro_user_prefs'

function loadCachedPrefs(): UserPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) }
  } catch { /* private mode */ }
  return DEFAULT_PREFS
}

function saveCachedPrefs(prefs: UserPreferences) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)) } catch { /* ignore */ }
}

export function useUserPreferences() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  // İlk değer: localStorage cache (hızlı), sonra backend ile sync
  const [prefs, setPrefs] = useState<UserPreferences>(() => loadCachedPrefs())

  // user değişince (login, /me sonrası) backend'den geleni uygula
  useEffect(() => {
    if (user?.preferences) {
      const merged = { ...DEFAULT_PREFS, ...user.preferences }
      setPrefs(merged)
      saveCachedPrefs(merged)
    }
  }, [user?.preferences])

  // Etkin tema (system mode için OS tercihine bak)
  const effectiveTheme: 'dark' | 'light' = (() => {
    if (prefs.theme !== 'system') return prefs.theme
    if (typeof window === 'undefined') return 'dark'
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })()

  // HTML'e data-theme attribute uygula — CSS variable'lar bunu okur
  useEffect(() => {
    document.documentElement.dataset.theme = effectiveTheme
  }, [effectiveTheme])

  const update = useCallback(async (patch: Partial<UserPreferences>) => {
    const next = { ...prefs, ...patch }
    setPrefs(next)
    saveCachedPrefs(next)
    try {
      await authApi.updatePreferences(patch)
      // Authstore'da user.preferences'i de güncel tut
      if (user) setUser({ ...user, preferences: next })
    } catch {
      // Rollback
      setPrefs(prefs)
      saveCachedPrefs(prefs)
      toast.error('Tercihler kaydedilemedi')
    }
  }, [prefs, user, setUser])

  return {
    prefs,
    effectiveTheme,
    setTheme:    (theme: UserPreferences['theme']) => update({ theme }),
    setAccent:   (accentColor: string | null) => update({ accentColor }),
    toggleSound: () => update({ soundEnabled: !prefs.soundEnabled }),
    toggleShortcuts: () => update({ shortcutsEnabled: !prefs.shortcutsEnabled }),
  }
}
