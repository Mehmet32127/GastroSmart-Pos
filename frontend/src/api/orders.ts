import client from './client'
import type { Order, OrderItem, PaymentMethod, ApiResponse } from '@/types'

export interface CreateOrderPayload {
  tableId: string
  guestCount?: number
  note?: string
}

export interface AddItemPayload {
  menuItemId: string
  quantity: number
  note?: string
}

export interface UpdateItemPayload {
  quantity?: number
  note?: string
  status?: OrderItem['status']
}

export interface CloseOrderPayload {
  paymentMethod: PaymentMethod
  paidAmount: number
  cashAmount?: number
  cardAmount?: number
  discount?: number
  discountType?: 'percent' | 'amount'
  note?: string
}

export interface SplitPayload {
  splits: Array<{ amount: number; paymentMethod: 'cash' | 'card' | 'complimentary' }>
  discount?: number
  discountType?: 'percent' | 'amount'
  note?: string
}

export const ordersApi = {
  getAll: (params?: { tableId?: string; status?: string; page?: number; limit?: number }) =>
    client.get<ApiResponse<Order[]>>('/orders', { params }),

  getById: (id: string) =>
    client.get<ApiResponse<Order>>(`/orders/${id}`),

  getByTable: (tableId: string) =>
    client.get<ApiResponse<Order>>(`/orders/table/${tableId}`),

  create: (payload: CreateOrderPayload) =>
    client.post<ApiResponse<Order>>('/orders', payload),

  addItem: (orderId: string, item: AddItemPayload) =>
    client.post<ApiResponse<OrderItem>>(`/orders/${orderId}/items`, item),

  updateItem: (orderId: string, itemId: string, data: UpdateItemPayload) =>
    client.patch<ApiResponse<OrderItem>>(`/orders/${orderId}/items/${itemId}`, data),

  removeItem: (orderId: string, itemId: string) =>
    client.delete<ApiResponse>(`/orders/${orderId}/items/${itemId}`),

  close: (orderId: string, payload: CloseOrderPayload) =>
    client.post<ApiResponse<Order>>(`/orders/${orderId}/close`, payload),

  split: (orderId: string, payload: SplitPayload) =>
    client.post<ApiResponse<Order>>(`/orders/${orderId}/split`, payload),

  void: (orderId: string, reason?: string) =>
    client.post<ApiResponse>(`/orders/${orderId}/void`, { reason }),

  printReceipt: (orderId: string) =>
    client.get<ApiResponse<{ html: string }>>(`/print/receipt/${orderId}`),
}
