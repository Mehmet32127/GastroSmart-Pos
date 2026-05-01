import client from './client'
import type { Reservation, ReservationStatus, ApiResponse } from '@/types'

export interface CreateReservationPayload {
  customerName: string
  customerPhone: string
  customerEmail?: string
  guestCount: number
  date: string
  time: string
  durationMin?: number
  tableId?: string
  deposit?: number
  note?: string
}

export interface UpdateReservationPayload {
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  guestCount?: number
  date?: string
  time?: string
  durationMin?: number
  tableId?: string | null
  deposit?: number
  note?: string
}

export const reservationsApi = {
  getAll: (params?: { date?: string; status?: ReservationStatus; tableId?: string }) =>
    client.get<ApiResponse<Reservation[]>>('/reservations', { params }),

  getById: (id: string) =>
    client.get<ApiResponse<Reservation>>(`/reservations/${id}`),

  create: (data: CreateReservationPayload) =>
    client.post<ApiResponse<Reservation>>('/reservations', data),

  update: (id: string, data: UpdateReservationPayload) =>
    client.put<ApiResponse<Reservation>>(`/reservations/${id}`, data),

  updateStatus: (id: string, status: ReservationStatus, options?: { depositPaid?: boolean; depositRefunded?: boolean }) =>
    client.patch<ApiResponse<Reservation>>(`/reservations/${id}/status`, { status, ...options }),

  refundDeposit: (id: string) =>
    client.post<ApiResponse<Reservation>>(`/reservations/${id}/refund`),

  delete: (id: string) =>
    client.delete<ApiResponse>(`/reservations/${id}`),

  restore: (id: string) =>
    client.post<ApiResponse<Reservation>>(`/reservations/${id}/restore`),
}
