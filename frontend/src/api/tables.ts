import client from './client'
import type { Table, TableStatus, ApiResponse } from '@/types'

export const tablesApi = {
  getAll: () =>
    client.get<ApiResponse<Table[]>>('/tables'),

  getById: (id: string) =>
    client.get<ApiResponse<Table>>(`/tables/${id}`),

  updateStatus: (id: string, status: TableStatus) =>
    client.patch<ApiResponse<Table>>(`/tables/${id}/status`, { status }),

  create: (data: Partial<Table>) =>
    client.post<ApiResponse<Table>>('/tables', data),

  update: (id: string, data: Partial<Table>) =>
    client.put<ApiResponse<Table>>(`/tables/${id}`, data),

  delete: (id: string) =>
    client.delete<ApiResponse>(`/tables/${id}`),

  merge: (sourceTableId: string, targetTableId: string) =>
    client.post<ApiResponse<{ sourceTable: Table; targetTable: Table }>>(
      '/tables/merge',
      { sourceTableId, targetTableId }
    ),

  transfer: (fromTableId: string, toTableId: string) =>
    client.post<ApiResponse<{ fromTable: Table; toTable: Table }>>(
      '/tables/transfer',
      { fromTableId, toTableId }
    ),
}
