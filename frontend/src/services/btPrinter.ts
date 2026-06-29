// Web Bluetooth (BLE) termal yazıcı servisi — modele kilitlenmez.
//
// Çalışma: kullanıcı cihazı seçer → GATT'a bağlanır → tüm servisleri tarayıp
// YAZILABİLİR ilk karakteristiği bulur → ESC/POS baytlarını parça parça yazar.
// Yaygın termal yazıcı servis UUID'leri optionalServices'e eklenir (acceptAllDevices
// ile bunlara erişebilmek için listelenmeleri ZORUNLU).
//
// NOT: Web Bluetooth yalnızca BLE konuşur — Bluetooth Classic (SPP) yazıcılara
// erişemez. Classic yazıcılar için Capacitor APK + native plugin gerekir.

const PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000ff80-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
]

const CHUNK = 180   // BLE paket sınırı için güvenli parça boyutu
const CHUNK_DELAY = 18 // ms — yazıcı tamponu taşmasın

export type PrinterStatus = 'disconnected' | 'connecting' | 'connected'

interface Listener { (status: PrinterStatus, deviceName: string | null): void }

class BtPrinter {
  private device: BluetoothDevice | null = null
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null
  private listeners = new Set<Listener>()
  status: PrinterStatus = 'disconnected'
  deviceName: string | null = null

  get supported(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.bluetooth
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit() {
    for (const fn of this.listeners) fn(this.status, this.deviceName)
  }

  private setStatus(s: PrinterStatus) {
    this.status = s
    if (s === 'disconnected') { this.characteristic = null }
    this.emit()
  }

  /** Kullanıcıya cihaz seçtirip bağlanır (kullanıcı jesti içinde çağrılmalı). */
  async connect(): Promise<void> {
    if (!this.supported) throw new Error('Bu tarayıcı Web Bluetooth desteklemiyor (Chrome/Android gerekir).')
    this.setStatus('connecting')
    try {
      const device = await navigator.bluetooth!.requestDevice({
        acceptAllDevices: true,
        optionalServices: PRINTER_SERVICES,
      })
      await this.attach(device)
    } catch (err) {
      this.setStatus('disconnected')
      throw err
    }
  }

  /** Daha önce izin verilmiş cihaza sessizce yeniden bağlanmayı dener. */
  async tryReconnect(): Promise<boolean> {
    if (!this.supported || !navigator.bluetooth?.getDevices) return false
    try {
      const devices = await navigator.bluetooth.getDevices!()
      const prev = devices.find((d) => d.id === localStorage.getItem('gastro_printer_id'))
      if (!prev) return false
      await this.attach(prev)
      return true
    } catch { return false }
  }

  private async attach(device: BluetoothDevice): Promise<void> {
    this.device = device
    this.deviceName = device.name || 'Yazıcı'
    device.addEventListener('gattserverdisconnected', () => this.setStatus('disconnected'))

    const server = await device.gatt!.connect()
    // Yazılabilir karakteristiği bul
    let writable: BluetoothRemoteGATTCharacteristic | null = null
    const services = await server.getPrimaryServices()
    for (const svc of services) {
      const chars = await svc.getCharacteristics()
      for (const c of chars) {
        if (c.properties.write || c.properties.writeWithoutResponse) { writable = c; break }
      }
      if (writable) break
    }
    if (!writable) {
      server.disconnect()
      this.setStatus('disconnected')
      throw new Error('Yazıcıda yazılabilir kanal bulunamadı (BLE termal yazıcı değil olabilir).')
    }
    this.characteristic = writable
    try { localStorage.setItem('gastro_printer_id', device.id) } catch { /* private mode */ }
    this.setStatus('connected')
  }

  disconnect(): void {
    try { this.device?.gatt?.disconnect() } catch { /* yoksay */ }
    this.setStatus('disconnected')
  }

  /** ESC/POS bayt dizisini parça parça yazıcıya gönderir. */
  async write(data: Uint8Array): Promise<void> {
    const c = this.characteristic
    if (!c) throw new Error('Yazıcı bağlı değil')
    const useNoResponse = c.properties.writeWithoutResponse
    for (let i = 0; i < data.length; i += CHUNK) {
      const slice = data.slice(i, i + CHUNK)
      if (useNoResponse) await c.writeValueWithoutResponse(slice)
      else await c.writeValue(slice)
      if (i + CHUNK < data.length) await new Promise((r) => setTimeout(r, CHUNK_DELAY))
    }
  }
}

export const btPrinter = new BtPrinter()
