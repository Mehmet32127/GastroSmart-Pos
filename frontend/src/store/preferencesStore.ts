/**
 * Kullanıcı tercihleri global store — TEK source of truth.
 *
 * Önceki tasarım useState ile her component'te ayrı local state tutuyordu,
 * race condition yaratıyordu: TopBar tema değişti → local update, ama
 * AppLayout'taki kontrol ESKİ değeri görüyordu.
 *
 * Şimdi: Zustand ile global state. Tüm component'ler aynı objeyi okur,
 * bir yerde değişirse hepsi anında güncellenir.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserPreferences } from '@/types'
import { authApi } from '@/api/auth'

const DEFAULT_PREFS: UserPreferences = {
  theme:            'system',
  accentColor:      null,
  soundEnabled:     true,
  shortcutsEnabled: true,
}

interface PreferencesState {
  prefs: UserPreferences
  setPrefs: (prefs: Partial<UserPreferences>) => void  // local-only, /me sync için
  updatePrefs: (patch: Partial<UserPreferences>) => Promise<boolean>  // backend + local
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      prefs: DEFAULT_PREFS,

      // Backend'den /me ile geldiğinde local'i güncelle (sessizce)
      setPrefs: (prefs) => set({ prefs: { ...DEFAULT_PREFS, ...get().prefs, ...prefs } }),

      // Kullanıcı değiştirdiğinde — optimistic update + backend PATCH
      updatePrefs: async (patch) => {
        const prev = get().prefs
        const next = { ...prev, ...patch }
        set({ prefs: next })
        try {
          await authApi.updatePreferences(patch)
          return true
        } catch {
          // Rollback
          set({ prefs: prev })
          return false
        }
      },
    }),
    {
      name: 'gastro_user_prefs',
      partialize: (state) => ({ prefs: state.prefs }),
    }
  )
)

// Etkin tema (system mode için OS tercihine bak)
export function getEffectiveTheme(theme: UserPreferences['theme']): 'dark' | 'light' {
  if (theme !== 'system') return theme
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}
