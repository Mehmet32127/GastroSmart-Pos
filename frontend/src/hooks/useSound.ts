import { useCallback, useRef } from 'react'
import { useUserPreferences } from './useUserPreferences'

/**
 * Web Audio API ile basit bip sesi.
 *
 * Avantaj: ses dosyası gerekmez, paket boyutu artmaz.
 * Dezavantaj: AudioContext "user gesture" sonrası açılır
 *   (tarayıcı autoplay policy) — ilk tıklamaya kadar bip çıkmaz, sorun değil.
 *
 * 3 ses tipi:
 *   - 'notification' (yeni sipariş geldi): 880Hz, 150ms
 *   - 'success'      (sipariş kapatıldı): 660Hz, 100ms
 *   - 'warning'      (yetersiz stok vb): 440Hz, 200ms
 */

type SoundType = 'notification' | 'success' | 'warning'

const SOUND_CONFIG: Record<SoundType, { freq: number; duration: number }> = {
  notification: { freq: 880, duration: 150 },
  success:      { freq: 660, duration: 100 },
  warning:      { freq: 440, duration: 200 },
}

export function useSound() {
  const { prefs } = useUserPreferences()
  const ctxRef = useRef<AudioContext | null>(null)

  const play = useCallback((type: SoundType = 'notification') => {
    if (!prefs.soundEnabled) return  // kullanıcı kapatmış

    try {
      // Lazy init — ilk ses denemesinde context oluştur
      if (!ctxRef.current) {
        ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = ctxRef.current

      // Suspend olmuşsa devam ettir (autoplay policy)
      if (ctx.state === 'suspended') ctx.resume()

      const { freq, duration } = SOUND_CONFIG[type]
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq

      // Hafif fade-out (cliccch sesini önler)
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000)

      osc.connect(gain).connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + duration / 1000)
    } catch {
      // Audio context kullanılamıyor — sessizce geç
    }
  }, [prefs.soundEnabled])

  return { play }
}
