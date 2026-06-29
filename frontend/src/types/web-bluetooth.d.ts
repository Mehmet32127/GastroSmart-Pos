// Web Bluetooth API — minimal tip bildirimleri (lib.dom'da yok).
// Sadece btPrinter servisinin kullandığı yüzey. @types/web-bluetooth eklemeye
// gerek kalmadan TS'in tanıması için.

interface Navigator {
  bluetooth?: Bluetooth
}

interface Bluetooth {
  requestDevice(options?: {
    acceptAllDevices?: boolean
    filters?: unknown[]
    optionalServices?: string[]
  }): Promise<BluetoothDevice>
  getDevices?(): Promise<BluetoothDevice[]>
}

interface BluetoothDevice {
  id: string
  name?: string
  gatt?: BluetoothRemoteGATTServer
  addEventListener(type: 'gattserverdisconnected', listener: () => void): void
}

interface BluetoothRemoteGATTServer {
  connect(): Promise<BluetoothRemoteGATTServer>
  disconnect(): void
  getPrimaryServices(): Promise<BluetoothRemoteGATTService[]>
}

interface BluetoothRemoteGATTService {
  getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>
}

interface BluetoothRemoteGATTCharacteristic {
  properties: { write: boolean; writeWithoutResponse: boolean }
  writeValue(data: BufferSource): Promise<void>
  writeValueWithoutResponse(data: BufferSource): Promise<void>
}
