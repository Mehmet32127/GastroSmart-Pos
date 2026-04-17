import { create } from 'zustand'
import { settingsApi } from '@/api/settings'

interface SettingsStore {
  restaurantName: string
  currency: string
  timezone: string
  loaded: boolean
  load: () => Promise<void>
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  restaurantName: 'GastroSmart',
  currency: 'TRY',
  timezone: 'Europe/Istanbul',
  loaded: false,

  load: async () => {
    try {
      const { data: res } = await settingsApi.get()
      if (res.data) {
        set({
          restaurantName: res.data.restaurantName || 'GastroSmart',
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
