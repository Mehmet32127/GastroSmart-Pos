import React, { useState } from 'react'
import { HexColorPicker } from 'react-colorful'
import { Check, RefreshCw, Save } from 'lucide-react'
import { Card, Badge } from '@/components/ui/common'
import { Button } from '@/components/ui/Button'
import { useThemeStore, THEME_PRESETS } from '@/store/themeStore'
import { settingsApi } from '@/api/settings'
import { cn } from '@/utils/format'
import type { ThemePreset, ThemeColors } from '@/types'
import toast from 'react-hot-toast'

const PRESET_META: Record<ThemePreset, { label: string; emoji: string; desc: string }> = {
  dark:      { label: 'Koyu',    emoji: '🌙', desc: 'Klasik koyu tema' },
  coffee:    { label: 'Kahve',   emoji: '☕', desc: 'Sıcak kahverengi tonları' },
  fastfood:  { label: 'Fast Food', emoji: '🍔', desc: 'Yeşil enerji teması' },
  luxury:    { label: 'Lüks',    emoji: '✨', desc: 'Mor premium tema' },
}

const COLOR_LABELS: Record<keyof ThemeColors, string> = {
  bg: 'Arka Plan',
  surface: 'Yüzey',
  surface2: 'Yüzey 2',
  border: 'Kenarlık',
  text: 'Metin',
  textMuted: 'Soluk Metin',
  accent: 'Vurgu Rengi',
  accentText: 'Vurgu Metin',
}

export const ThemePage: React.FC = () => {
  const { theme, setPreset, setColor, setTheme, applyTheme } = useThemeStore()
  const [activeColorKey, setActiveColorKey] = useState<keyof ThemeColors | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [hexInputs, setHexInputs] = useState<Partial<Record<keyof ThemeColors, string>>>({})

  const handlePreset = (preset: ThemePreset) => {
    setPreset(preset)
    setHexInputs({})
    setActiveColorKey(null)
  }

  const handleColorChange = (key: keyof ThemeColors, value: string) => {
    setHexInputs((prev) => ({ ...prev, [key]: value }))
    if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
      setColor(key, value)
    }
  }

  const handleSaveToServer = async () => {
    setIsSaving(true)
    try {
      await settingsApi.updateTheme(theme)
      toast.success('Tema kaydedildi ve tüm tabletlere gönderildi!')
    } catch {
      toast.error('Tema kaydedilemedi')
    } finally {
      setIsSaving(false)
    }
  }

  const handleBorderRadius = (value: string) => {
    setTheme({ borderRadius: value })
  }

  // Preview component
  const PreviewCard = () => (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 shadow-card">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-xl bg-[var(--color-accent)] flex items-center justify-center">
          <span className="text-[var(--color-accent-text)] font-display font-bold text-xs">G</span>
        </div>
        <div>
          <p className="text-sm font-bold font-display text-[var(--color-text)]">GastroSmart</p>
          <p className="text-xs text-[var(--color-text-muted)] font-body">Anlık Önizleme</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {['Masa 1', 'Masa 2', 'Masa 3'].map((name, i) => (
          <div key={name} className={cn(
            'rounded-xl p-2 text-center border text-xs font-body',
            i === 0 ? 'bg-green-500/15 border-green-500/30 text-green-400' :
            i === 1 ? 'bg-red-500/15 border-red-500/30 text-red-400' :
            'bg-[var(--color-surface2)] border-[var(--color-border)] text-[var(--color-text-muted)]'
          )}>
            <p className="font-bold text-[var(--color-text)]">{name}</p>
            <p>{i === 0 ? 'Boş' : i === 1 ? 'Dolu' : 'Rezerve'}</p>
          </div>
        ))}
      </div>
      <button className="w-full py-2 rounded-xl text-xs font-semibold font-body transition-colors"
        style={{ background: 'var(--color-accent)', color: 'var(--color-accent-text)' }}>
        Ödeme Al
      </button>
    </div>
  )

  return (
    <div className="p-5 max-w-5xl mx-auto space-y-5 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-display text-[var(--color-text)]">Tema Özelleştirme</h1>
          <p className="text-sm text-[var(--color-text-muted)] font-body">Değişiklikler tüm cihazlara otomatik uygulanır</p>
        </div>
        <Button icon={<Save size={16} />} loading={isSaving} onClick={handleSaveToServer}>
          Kaydet & Yayınla
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Controls */}
        <div className="lg:col-span-2 space-y-5">
          {/* Presets */}
          <Card>
            <h2 className="text-sm font-semibold font-display text-[var(--color-text)] mb-3">Hazır Şablonlar</h2>
            <div className="grid grid-cols-4 gap-2">
              {(Object.entries(PRESET_META) as [ThemePreset, typeof PRESET_META[ThemePreset]][]).map(([preset, meta]) => (
                <button key={preset} onClick={() => handlePreset(preset)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-3 rounded-xl border text-center transition-all duration-200',
                    theme.preset === preset
                      ? 'border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10'
                      : 'border-[var(--color-border)] bg-[var(--color-surface2)] hover:border-[var(--color-accent)]/20'
                  )}>
                  <span className="text-2xl">{meta.emoji}</span>
                  <div>
                    <p className="text-xs font-semibold font-body text-[var(--color-text)]">{meta.label}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)] font-body">{meta.desc}</p>
                  </div>
                  {theme.preset === preset && (
                    <div className="w-4 h-4 rounded-full bg-[var(--color-accent)] flex items-center justify-center">
                      <Check size={10} className="text-[var(--color-accent-text)]" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </Card>

          {/* Color customization */}
          <Card>
            <h2 className="text-sm font-semibold font-display text-[var(--color-text)] mb-3">Renk Özelleştirme</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {(Object.keys(COLOR_LABELS) as (keyof ThemeColors)[]).map((key) => {
                const color = theme.colors[key]
                const isActive = activeColorKey === key
                return (
                  <button key={key} onClick={() => setActiveColorKey(isActive ? null : key)}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-xl border text-left transition-all duration-200',
                      isActive
                        ? 'border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5'
                        : 'border-[var(--color-border)] bg-[var(--color-surface2)] hover:border-[var(--color-accent)]/20'
                    )}>
                    <div className="w-6 h-6 rounded-lg flex-shrink-0 border border-white/10"
                      style={{ background: color }} />
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium text-[var(--color-text)] font-body truncate">{COLOR_LABELS[key]}</p>
                      <p className="text-[9px] text-[var(--color-text-muted)] font-mono">{color}</p>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Color picker */}
            {activeColorKey && (
              <div className="border-t border-[var(--color-border)] pt-4">
                <p className="text-xs font-medium text-[var(--color-text-muted)] font-body mb-3">
                  {COLOR_LABELS[activeColorKey]} seçin
                </p>
                <div className="flex gap-4 items-start">
                  <HexColorPicker
                    color={theme.colors[activeColorKey]}
                    onChange={(c) => handleColorChange(activeColorKey, c)}
                    style={{ width: 180, height: 140 }}
                  />
                  <div className="flex-1 space-y-2">
                    <div>
                      <label className="text-xs text-[var(--color-text-muted)] font-body">HEX</label>
                      <input
                        value={hexInputs[activeColorKey] ?? theme.colors[activeColorKey]}
                        onChange={(e) => handleColorChange(activeColorKey, e.target.value)}
                        className="w-full mt-1 bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-sm font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]/50"
                        placeholder="#000000"
                        maxLength={7}
                      />
                    </div>
                    <div className="w-full h-10 rounded-xl border border-[var(--color-border)]"
                      style={{ background: theme.colors[activeColorKey] }} />
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Layout options */}
          <Card>
            <h2 className="text-sm font-semibold font-display text-[var(--color-text)] mb-3">Düzen Seçenekleri</h2>
            <div>
              <label className="text-xs font-medium text-[var(--color-text-muted)] font-body mb-2 block">
                Köşe Yuvarlama
              </label>
              <div className="flex gap-2">
                {[
                  { value: '4px', label: 'Sert' },
                  { value: '8px', label: 'Az' },
                  { value: '12px', label: 'Normal' },
                  { value: '20px', label: 'Yuvarlak' },
                ].map((r) => (
                  <button key={r.value} onClick={() => handleBorderRadius(r.value)}
                    className={cn(
                      'flex-1 py-2 text-xs font-body border transition-all',
                      'rounded-xl',
                      theme.borderRadius === r.value
                        ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border-[var(--color-accent)]/30'
                        : 'bg-[var(--color-surface2)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:text-[var(--color-text)]'
                    )}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Preview */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold font-display text-[var(--color-text)]">Önizleme</h2>
          <PreviewCard />

          <Card padding="sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold font-display text-[var(--color-text)]">Aktif Tema</p>
              <Badge>{PRESET_META[theme.preset].emoji} {PRESET_META[theme.preset].label}</Badge>
            </div>
            <div className="flex gap-1">
              {(Object.values(theme.colors)).map((color, i) => (
                <div key={i} className="flex-1 h-3 rounded-sm" style={{ background: color }} />
              ))}
            </div>
          </Card>

          <button
            onClick={() => { setPreset(theme.preset); setHexInputs({}) }}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface2)] transition-colors font-body"
          >
            <RefreshCw size={12} /> Sıfırla
          </button>
        </div>
      </div>
    </div>
  )
}
