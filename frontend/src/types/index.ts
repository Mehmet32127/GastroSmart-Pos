// ─── Auth ───────────────────────────────────────────────────────────────────
// admin   : Sahibi — her şey
// manager : Müdür — denetim/raporlar/menü, sipariş AÇMAZ/KAPATMAZ
// cashier : Kasiyer — sipariş aç/kapat/öde, masa transfer
// waiter  : Garson — sipariş aç/kalem ekle, masa durumu
export type UserRole = 'admin' | 'manager' | 'cashier' | 'waiter'

// UI'da gösterilen Türkçe rol etiketleri — tek noktadan yönetim
export const ROLE_LABELS: Record<UserRole, string> = {
  admin:   'Sahibi',
  manager: 'Müdür',
  cashier: 'Kasiyer',
  waiter:  'Garson',
}

export interface UserPreferences {
  theme:            'dark' | 'light' | 'system'
  accentColor:      string | null
  soundEnabled:     boolean
  shortcutsEnabled: boolean
}

export interface User {
  id: string
  username: string
  fullName: string
  role: UserRole
  email?: string
  phone?: string
  active: boolean
  createdAt: string
  tenantSlug?: string | null
  preferences?: UserPreferences
  avatarData?: string | null   // Base64 data URL — yeni, kalıcı
  avatarUrl?: string | null    // Legacy — geriye uyumluluk
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface LoginCredentials {
  tenantSlug?: string  // Multi-tenant: hangi restoran. Verilmezse legacy demo'ya bağlanır.
  username: string
  password: string
}

// ─── Tables ─────────────────────────────────────────────────────────────────
export type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning'

export interface Table {
  id: string
  number: number
  name: string
  capacity: number
  status: TableStatus
  section?: string
  note?: string
  posX?: number
  posY?: number
  currentOrderId?: string
  activeOrderTotal?: number
  waiterId?: string
  waiterName?: string
  openedAt?: string
  hasNewItem?: boolean
}

// ─── Menu ────────────────────────────────────────────────────────────────────
export interface Category {
  id: string
  name: string
  icon: string
  color: string
  sortOrder: number
  active: boolean
}

export interface MenuItem {
  id: string
  categoryId: string
  categoryName: string
  name: string
  description?: string
  price: number
  cost?: number
  stock?: number
  minStock?: number
  unit: string
  tax: number
  active: boolean
  imageUrl?: string
  tags?: string[]
}

// ─── Orders ──────────────────────────────────────────────────────────────────
export type OrderStatus = 'open' | 'closed' | 'cancelled' | 'voided'
export type PaymentMethod = 'cash' | 'card' | 'mixed' | 'complimentary'

export interface OrderItem {
  id: string
  orderId: string
  menuItemId: string
  menuItemName: string
  quantity: number
  unitPrice: number
  totalPrice: number
  tax: number
  note?: string
  status: 'pending' | 'preparing' | 'served' | 'cancelled'
  waiterId?: string
  waiterName?: string
  createdAt: string
  updatedAt: string
}

export interface Order {
  id: string
  tableId: string
  tableName: string
  waiterId: string
  waiterName: string
  status: OrderStatus
  items: OrderItem[]
  subtotal: number
  taxTotal: number
  discount: number
  discountType: 'percent' | 'amount'
  total: number
  paidAmount: number
  cashAmount?: number
  cardAmount?: number
  change: number
  paymentMethod?: PaymentMethod
  note?: string
  guestCount: number
  openedAt: string
  closedAt?: string
  createdAt: string
}

// ─── Reservations ────────────────────────────────────────────────────────────
export type ReservationStatus = 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled'

export interface Reservation {
  id: string
  code: string | null
  tableId?: string
  tableName?: string
  guestCount: number
  date: string
  time: string
  endTime?: string
  durationMin?: number
  status: ReservationStatus
  deposit?: number
  depositPaid: boolean
  depositRefunded?: boolean
  note?: string
  createdAt: string
  updatedAt: string
}

// ─── Reports ─────────────────────────────────────────────────────────────────
export interface DailySummary {
  date: string
  totalRevenue: number
  totalOrders: number
  cashRevenue: number
  cardRevenue: number
  averageOrderValue: number
  topItems: { name: string; count: number; revenue: number }[]
}

export interface WaiterPerformance {
  waiterId: string
  waiterName: string
  totalOrders: number
  totalRevenue: number
  averageOrderValue: number
  avgServiceTime: number
}

export interface HourlySales {
  hour: number
  revenue: number
  orders: number
}

// ─── Notifications ───────────────────────────────────────────────────────────
export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'order'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  read: boolean
  createdAt: string
  data?: Record<string, unknown>
}

// ─── Theme ───────────────────────────────────────────────────────────────────
export type ThemePreset = 'dark' | 'coffee' | 'fastfood' | 'luxury'

export interface ThemeColors {
  bg: string
  surface: string
  surface2: string
  border: string
  text: string
  textMuted: string
  accent: string
  accentText: string
}

export interface Theme {
  preset: ThemePreset
  colors: ThemeColors
  borderRadius: string
  fontScale: string
}

// ─── Offline Queue ───────────────────────────────────────────────────────────
export type QueueActionType =
  | 'CREATE_ORDER'
  | 'UPDATE_ORDER'
  | 'ADD_ORDER_ITEM'
  | 'UPDATE_ORDER_ITEM'
  | 'REMOVE_ORDER_ITEM'
  | 'CLOSE_ORDER'
  | 'UPDATE_TABLE_STATUS'
  | 'CREATE_RESERVATION'
  | 'UPDATE_RESERVATION'

export interface QueueItem {
  id: string
  type: QueueActionType
  payload: Record<string, unknown>
  hmac: string
  createdAt: string
  retries: number
}

// ─── Cash Register ───────────────────────────────────────────────────────────
export interface Banknote {
  value: number
  label: string
  count: number
}

export interface CashCount {
  banknotes: Banknote[]
  total: number
  expectedTotal: number
  difference: number
  note?: string
  closedAt?: string
  closedBy?: string
}

// ─── API Response ────────────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// ─── Socket Events ───────────────────────────────────────────────────────────
export interface SocketEvents {
  'table:updated': (table: Table) => void
  'order:created': (order: Order) => void
  'order:updated': (order: Order) => void
  'order:item:added': (data: { orderId: string; item: OrderItem }) => void
  'notification:new': (notification: Notification) => void
  'theme:updated': (theme: Theme) => void
  'sync:request': () => void
}
