// Web Bluetooth (BLE) termal yazıcı servisi — modele kilitlenmez, ROL başına ayrı.
//
// Restoran iki yazıcı kullanabilir: "kitchen" (mutfak) ve "cashier" (kasa).
// Her rol için ayrı BtPrinter örneği → ayrı cihaz, ayrı bağlantı, ayrı hatırlama.
//
// Çalışma: kullanıcı cihazı seçer → GATT'a bağlanır → tüm servisleri tarayıp
// YAZILABİLİR ilk karakteristiği bulur → ESC/POS baytlarını parça parça yazar.
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

const CHUNK = 180
const CHUNK_DELAY = 18

export type PrinterRole = 'kitchen' | 'cashier'
export type PrinterStatus = 'disconnected' | 'connecting' | 'connected'

interface Listener { (status: PrinterStatus, deviceName: string | null): void }

class BtPrinter {
  private device: BluetoothDevice | null = null
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null
  private listeners = new Set<Listener>()
  private storageKey: string
  status: PrinterStatus = 'disconnected'
  deviceName: string | null = null

  constructor(role: PrinterRole) {
    this.storageKey = `gastro_printer_id_${role}`
  }

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
    if (s === 'disconnected') this.characteristic = null
    this.emit()
  }

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

  async tryReconnect(): Promise<boolean> {
    if (!this.supported || !navigator.bluetooth?.getDevices) return false
    try {
      const devices = await navigator.bluetooth.getDevices!()
      const prev = devices.find((d) => d.id === localStorage.getItem(this.storageKey))
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
    try { localStorage.setItem(this.storageKey, device.id) } catch { /* private mode */ }
    this.setStatus('connected')
  }

  disconnect(): void {
    try { this.device?.gatt?.disconnect() } catch { /* yoksay */ }
    try { localStorage.removeItem(this.storageKey) } catch { /* private mode */ }
    this.setStatus('disconnected')
  }

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

// Rol başına tekil örnekler
export const printers: Record<PrinterRole, BtPrinter> = {
  kitchen: new BtPrinter('kitchen'),
  cashier: new BtPrinter('cashier'),
}
