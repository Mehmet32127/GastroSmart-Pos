import { create } from 'zustand'
import type { Order, OrderItem } from '@/types'

interface OrderState {
  currentOrder: Order | null
  orders: Order[]
  isLoading: boolean
  setCurrentOrder: (order: Order | null) => void
  updateCurrentOrder: (updates: Partial<Order>) => void
  addItemToCurrentOrder: (item: OrderItem) => void
  updateItemInCurrentOrder: (itemId: string, updates: Partial<OrderItem>) => void
  removeItemFromCurrentOrder: (itemId: string) => void
  setOrders: (orders: Order[]) => void
  setLoading: (loading: boolean) => void
  calculateTotals: () => { subtotal: number; taxTotal: number; total: number }
}

export const useOrderStore = create<OrderState>((set, get) => ({
  currentOrder: null,
  orders: [],
  isLoading: false,

  setCurrentOrder: (order) => set({ currentOrder: order }),

  updateCurrentOrder: (updates) =>
    set((state) => ({
      currentOrder: state.currentOrder ? { ...state.currentOrder, ...updates } : null,
    })),

  addItemToCurrentOrder: (item) =>
    set((state) => {
      if (!state.currentOrder) return state

      // Aynı ürünü birleştir — sadece not yoksa (notlu kalemler ayrı satırda kalır)
      const existing = state.currentOrder.items.find(
        (i) => i.menuItemId === item.menuItemId && !i.note && !item.note
      )

      if (existing) {
        const newQty = existing.quantity + item.quantity
        return {
          currentOrder: {
            ...state.currentOrder,
            items: state.currentOrder.items.map((i) =>
              i.id === existing.id
                ? { ...i, quantity: newQty, totalPrice: parseFloat((newQty * i.unitPrice).toFixed(2)) }
                : i
            ),
          },
        }
      }

      return {
        currentOrder: {
          ...state.currentOrder,
          items: [...state.currentOrder.items, item],
        },
      }
    }),

  updateItemInCurrentOrder: (itemId: string, updates) =>
    set((state) => ({
      currentOrder: state.currentOrder
        ? {
            ...state.currentOrder,
            items: state.currentOrder.items.map((i) =>
              i.id === itemId ? { ...i, ...updates } : i
            ),
          }
        : null,
    })),

  removeItemFromCurrentOrder: (itemId: string) =>
    set((state) => ({
      currentOrder: state.currentOrder
        ? {
            ...state.currentOrder,
            items: state.currentOrder.items.filter((i) => i.id !== itemId),
          }
        : null,
    })),

  setOrders: (orders) => set({ orders }),
  setLoading: (isLoading) => set({ isLoading }),

  calculateTotals: () => {
    const { currentOrder } = get()
    if (!currentOrder) return { subtotal: 0, taxTotal: 0, total: 0 }

    const activeItems = currentOrder.items.filter((i) => i.status !== 'cancelled')

    const subtotal = activeItems.reduce((acc, item) => acc + item.totalPrice, 0)

    const taxTotal = activeItems.reduce(
      (acc, item) => acc + (item.totalPrice * item.tax) / (100 + item.tax),
      0
    )

    const discount =
      currentOrder.discountType === 'percent'
        ? subtotal * (currentOrder.discount / 100)
        : currentOrder.discount

    const total = Math.max(0, subtotal - discount)

    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      taxTotal: parseFloat(taxTotal.toFixed(2)),
      total:    parseFloat(total.toFixed(2)),
    }
  },
}))
