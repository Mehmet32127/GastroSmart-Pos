import { create } from 'zustand'
import { settingsApi } from '@/api/settings'

interface SettingsStore {
  restaurantName: string
  logoUrl: string | null
  currency: string
  timezone: string
  loaded: boolean
  load: () => Promise<void>
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  restaurantName: 'GastroSmart',
  logoUrl: null,
  currency: 'TRY',
  timezone: 'Europe/Istanbul',
  loaded: false,

  load: async () => {
    try {
      const { data: res } = await settingsApi.get()
      if (res.data) {
        set({
          restaurantName: res.data.restaurantName || 'GastroSmart',
          logoUrl: res.data.logoUrl || null,
          currency: res.data.currency || 'TRY',
          timezone: res.data.timezone || 'Europe/Istanbul',
          loaded: true,
        })
      }
    } catch {
      set({ loaded: true })
    }
  },
}))
