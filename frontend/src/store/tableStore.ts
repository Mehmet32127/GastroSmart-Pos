import { create } from 'zustand'
import type { Table } from '@/types'

interface TableState {
  tables: Table[]
  selectedTable: Table | null
  isLoading: boolean
  searchQuery: string
  statusFilter: string
  setTables: (tables: Table[]) => void
  updateTable: (table: Partial<Table> & { id: string }) => void
  setSelectedTable: (table: Table | null) => void
  setLoading: (loading: boolean) => void
  setSearchQuery: (query: string) => void
  setStatusFilter: (filter: string) => void
  getFilteredTables: () => Table[]
  markNewItem: (tableId: string) => void
  clearNewItem: (tableId: string) => void
}

export const useTableStore = create<TableState>((set, get) => ({
  tables: [],
  selectedTable: null,
  isLoading: false,
  searchQuery: '',
  statusFilter: 'all',

  setTables: (tables) => set({ tables }),

  updateTable: (updatedTable) =>
    set((state) => ({
      tables: state.tables.map((t) =>
        t.id === updatedTable.id ? { ...t, ...updatedTable } : t
      ),
      selectedTable:
        state.selectedTable?.id === updatedTable.id
          ? { ...state.selectedTable, ...updatedTable }
          : state.selectedTable,
    })),

  setSelectedTable: (table) => set({ selectedTable: table }),
  setLoading: (isLoading) => set({ isLoading }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),

  getFilteredTables: () => {
    const { tables, searchQuery, statusFilter } = get()
    return tables.filter((t) => {
      const matchesSearch =
        !searchQuery ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.number.toString().includes(searchQuery)
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter
      return matchesSearch && matchesStatus
    })
  },

  markNewItem: (tableId: string) =>
    set((state) => ({
      tables: state.tables.map((t) =>
        t.id === tableId ? { ...t, hasNewItem: true } : t
      ),
    })),

  clearNewItem: (tableId: string) =>
    set((state) => ({
      tables: state.tables.map((t) =>
        t.id === tableId ? { ...t, hasNewItem: false } : t
      ),
    })),
}))
