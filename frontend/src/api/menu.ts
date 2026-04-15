import client from './client'
import type { Category, MenuItem, ApiResponse } from '@/types'

export const menuApi = {
  getCategories: () =>
    client.get<ApiResponse<Category[]>>('/menu/categories'),

  createCategory: (data: Partial<Category>) =>
    client.post<ApiResponse<Category>>('/menu/categories', data),

  updateCategory: (id: string, data: Partial<Category>) =>
    client.put<ApiResponse<Category>>(`/menu/categories/${id}`, data),

  deleteCategory: (id: string) =>
    client.delete<ApiResponse>(`/menu/categories/${id}`),

  getItems: (params?: { categoryId?: string; active?: boolean; search?: string }) =>
    client.get<ApiResponse<MenuItem[]>>('/menu/items', { params }),

  getItemById: (id: string) =>
    client.get<ApiResponse<MenuItem>>(`/menu/items/${id}`),

  createItem: (data: Partial<MenuItem>) =>
    client.post<ApiResponse<MenuItem>>('/menu/items', data),

  updateItem: (id: string, data: Partial<MenuItem>) =>
    client.put<ApiResponse<MenuItem>>(`/menu/items/${id}`, data),

  deleteItem: (id: string) =>
    client.delete<ApiResponse>(`/menu/items/${id}`),

  updateStock: (id: string, quantity: number, operation: 'set' | 'add' | 'subtract') =>
    client.patch<ApiResponse<MenuItem>>(`/menu/items/${id}/stock`, { quantity, operation }),
}
