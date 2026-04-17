import { formatDistanceToNow, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'

const TZ = 'Europe/Istanbul'

const toDate = (date: string | Date): Date =>
  typeof date === 'string' ? new Date(date) : date

// Ayarlardan dinamik para birimi — setActiveCurrency() ile güncellenir
const CURRENCY_SYMBOLS: Record<string, string> = {
  TRY: '₺', USD: '$', EUR: '€', GBP: '£',
}
let _activeCurrency = 'TRY'
export const setActiveCurrency = (currency: string) => { _activeCurrency = currency }

export const formatCurrency = (amount: number): string => {
  const symbol = CURRENCY_SYMBOLS[_activeCurrency] ?? _activeCurrency
  return symbol + new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

export const formatDate = (date: string | Date): string =>
  new Intl.DateTimeFormat('tr-TR', {
    timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric',
  }).format(toDate(date))

export const formatDateTime = (date: string | Date): string =>
  new Intl.DateTimeFormat('tr-TR', {
    timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(toDate(date))

export const formatTime = (date: string | Date): string =>
  new Intl.DateTimeFormat('tr-TR', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit',
  }).format(toDate(date))

export const formatRelative = (date: string | Date): string =>
  formatDistanceToNow(typeof date === 'string' ? parseISO(date) : new Date(date), { addSuffix: true, locale: tr })

export const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes}dk`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}s ${m}dk` : `${h}s`
}

export const cn = (...classes: (string | undefined | null | false)[]): string =>
  classes.filter(Boolean).join(' ')

export const generateId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

export const maskSensitive = (value: string, visibleChars = 4): string => {
  if (value.length <= visibleChars) return '***'
  return value.slice(0, visibleChars) + '*'.repeat(value.length - visibleChars)
}

export const truncate = (str: string, maxLength: number): string =>
  str.length > maxLength ? str.slice(0, maxLength) + '…' : str

export const getInitials = (name: string): string =>
  name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

export const BANKNOTES_TRY = [200, 100, 50, 20, 10, 5, 1]
export const COINS_TRY = [5, 2.5, 1, 0.5, 0.25, 0.1]
