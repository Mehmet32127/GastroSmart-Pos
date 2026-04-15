import { useEffect } from 'react'
import { useThemeStore } from '@/store/themeStore'

export function useTheme() {
  const store = useThemeStore()

  useEffect(() => {
    store.applyTheme()
  }, [])

  return store
}
