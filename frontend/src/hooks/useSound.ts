import { useCallback, useRef, useEffect } from 'react'
import { useUserPreferences } from './useUserPreferences'

/**
 * Web Audio API ile bildirim sesi.
 *
 * Stratejisi:
 *   - Tarayıcı autoplay policy: AudioContext sadece kullanıcı etkileşiminden
 *     SONRA açılır. Çözüm: ilk click/keydown/touch'ta global context "unlock"
 *     ediliyor. Böylece arka planda Socket event'i geldiğinde ses çıkıyor.
 *   - Tek bip belirsizdi — şimdi 2-3 tonlu melodi çalıyor (POS hissi).
 *
 * Ses tipleri:
 *   - 'notification' → di-din (880Hz + 1100Hz, dikkat çeker)
 *   - 'success'      → yükselen do-re-mi (sipariş kapandı)
 *   - 'warning'      → 3x kısa bip (440Hz, problem)
 */

type SoundType = 'notification' | 'success' | 'warning'

// Her ses tipi için tonlar (her ton: frekans Hz + süre ms + delay ms)
const SOUND_PATTERNS: Record<SoundType, Array<{ freq: number; ms: number; delay: number }>> = {
  notification: [
    { freq: 880,  ms: 120, delay: 0 },
    { freq: 1100, ms: 180, delay: 130 },
  ],
  success: [
    { freq: 660,  ms: 90, delay: 0 },
    { freq: 880,  ms: 90, delay: 100 },
    { freq: 1100, ms: 150, delay: 200 },
  ],
  warning: [
    { freq: 440, ms: 100, delay: 0 },
    { freq: 440, ms: 100, delay: 150 },
    { freq: 440, ms: 100, delay: 300 },
  ],
}

// Global AudioContext — sadece bir tane, unlock state'i tüm component'lerle paylaşılır
let globalCtx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!globalCtx) {
    try {
      globalCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch {
      return null
    }
  }
  return globalCtx
}

export function useSound() {
  const { prefs } = useUserPreferences()
  const unlockedRef = useRef(false)

  // İlk kullanıcı etkileşiminde AudioContext'i unlock et.
  // Bundan sonra arka plan event'leri (Socket) bile ses çalabilir.
  useEffect(() => {
    if (unlockedRef.current) return

    const unlock = () => {
      const ctx = getCtx()
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {})
      }
      unlockedRef.current = true
      // Tek seferlik — listener'ları kaldır
      ;['click', 'keydown', 'touchstart'].forEach((e) =>
        document.removeEventListener(e, unlock)
      )
    }

    ;['click', 'keydown', 'touchstart'].forEach((e) =>
      document.addEventListener(e, unlock, { once: true, passive: true })
    )

    return () => {
      ;['click', 'keydown', 'touchstart'].forEach((e) =>
        document.removeEventListener(e, unlock)
      )
    }
  }, [])

  const playTone = useCallback((ctx: AudioContext, freq: number, ms: number, startAt: number) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    // Hafif attack + decay (cliccch sesi olmasın)
    gain.gain.setValueAtTime(0.0001, startAt)
    gain.gain.exponentialRampToValueAtTime(0.35, startAt + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + ms / 1000)
    osc.connect(gain).connect(ctx.destination)
    osc.start(startAt)
    osc.stop(startAt + ms / 1000)
  }, [])

  const play = useCallback((type: SoundType = 'notification') => {
    if (!prefs.soundEnabled) return
    const ctx = getCtx()
    if (!ctx) return

    // Suspend ise resume dene (kullanıcı henüz tıklamadıysa fail olabilir — OK)
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})

    const now = ctx.currentTime
    SOUND_PATTERNS[type].forEach((tone) => {
      playTone(ctx, tone.freq, tone.ms, now + tone.delay / 1000)
    })
  }, [prefs.soundEnabled, playTone])

  return { play }
}
