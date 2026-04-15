import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Theme, ThemeColors, ThemePreset } from '@/types'
import { CONFIG } from '@/config'

export const THEME_PRESETS: Record<ThemePreset, ThemeColors> = {
  dark: {
    bg: '#0f1117',
    surface: '#161923',
    surface2: '#1e2235',
    border: '#2d3348',
    text: '#f0f2f8',
    textMuted: '#6b7280',
    accent: '#f59e0b',
    accentText: '#0f1117',
  },
  coffee: {
    bg: '#1a1008',
    surface: '#241506',
    surface2: '#2e1c0a',
    border: '#4a2c15',
    text: '#f5e6d3',
    textMuted: '#a0826d',
    accent: '#d97706',
    accentText: '#1a1008',
  },
  fastfood: {
    bg: '#0f1a0f',
    surface: '#141f14',
    surface2: '#1a281a',
    border: '#2a3d2a',
    text: '#e8f5e8',
    textMuted: '#6b8b6b',
    accent: '#22c55e',
    accentText: '#0f1a0f',
  },
  luxury: {
    bg: '#0a0a0f',
    surface: '#12121a',
    surface2: '#1a1a26',
    border: '#2a2a40',
    text: '#f0f0f8',
    textMuted: '#8080a0',
    accent: '#a78bfa',
    accentText: '#0a0a0f',
  },
}

const DEFAULT_THEME: Theme = {
  preset: 'dark',
  colors: THEME_PRESETS.dark,
  borderRadius: '12px',
  fontScale: '1',
}

interface ThemeState {
  theme: Theme
  setTheme: (theme: Partial<Theme>) => void
  setPreset: (preset: ThemePreset) => void
  setColor: (key: keyof ThemeColors, value: string) => void
  applyTheme: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: DEFAULT_THEME,

      setTheme: (updates) => {
        set((state) => ({ theme: { ...state.theme, ...updates } }))
        get().applyTheme()
      },

      setPreset: (preset) => {
        set({ theme: { ...get().theme, preset, colors: THEME_PRESETS[preset] } })
        get().applyTheme()
      },

      setColor: (key, value) => {
        set((state) => ({
          theme: {
            ...state.theme,
            colors: { ...state.theme.colors, [key]: value },
          },
        }))
        get().applyTheme()
      },

      applyTheme: () => {
        const { theme } = get()
        const root = document.documentElement
        root.style.setProperty('--color-bg', theme.colors.bg)
        root.style.setProperty('--color-surface', theme.colors.surface)
        root.style.setProperty('--color-surface2', theme.colors.surface2)
        root.style.setProperty('--color-border', theme.colors.border)
        root.style.setProperty('--color-text', theme.colors.text)
        root.style.setProperty('--color-text-muted', theme.colors.textMuted)
        root.style.setProperty('--color-accent', theme.colors.accent)
        root.style.setProperty('--color-accent-text', theme.colors.accentText)
        root.style.setProperty('--border-radius', theme.borderRadius)
        root.style.setProperty('--font-scale', theme.fontScale)
      },
    }),
    {
      name: CONFIG.THEME_STORAGE_KEY,
      onRehydrateStorage: () => (state) => state?.applyTheme(),
    }
  )
)
