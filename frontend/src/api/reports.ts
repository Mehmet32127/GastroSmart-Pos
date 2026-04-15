import client from './client'
import type { DailySummary, WaiterPerformance, HourlySales, ApiResponse } from '@/types'

export const reportsApi = {
  getDailySummary: (date?: string) =>
    client.get<ApiResponse<DailySummary>>('/reports/daily', { params: { date } }),

  getWeeklySummary: (startDate?: string) =>
    client.get<ApiResponse<DailySummary[]>>('/reports/weekly', { params: { startDate } }),

  getHourlySales: (date?: string) =>
    client.get<ApiResponse<HourlySales[]>>('/reports/hourly', { params: { date } }),

  getWaiterPerformance: (startDate?: string, endDate?: string) =>
    client.get<ApiResponse<WaiterPerformance[]>>('/reports/waiters', {
      params: { startDate, endDate },
    }),

  getTopItems: (params?: { limit?: number; startDate?: string; endDate?: string }) =>
    client.get<ApiResponse<{ id: string; name: string; count: number; revenue: number }[]>>(
      '/reports/top-items',
      { params }
    ),

  exportExcel: (
    type: 'daily' | 'weekly' | 'waiters' | 'stock' | 'reservations',
    params?: Record<string, string>
  ) =>
    client.get(`/reports/export/${type}`, { params, responseType: 'blob' }),

  closeCashRegister: (data: { banknotes: Record<number, number>; note?: string }) =>
    client.post<ApiResponse>('/reports/cash-close', data),

  getCashHistory: (params?: { limit?: number }) =>
    client.get<ApiResponse>('/reports/cash-history', { params }),

  getDailyCiro: () =>
    client.get<ApiResponse<{ total: number; cash: number; card: number; orderCount: number }>>(
      '/reports/daily-ciro'
    ),
}
