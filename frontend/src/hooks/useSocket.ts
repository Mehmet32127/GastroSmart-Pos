import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { CONFIG } from '@/config'
import { useAuthStore } from '@/store/authStore'
import { useTableStore } from '@/store/tableStore'
import { useNotificationStore } from '@/store/notificationStore'
import { useThemeStore } from '@/store/themeStore'
import type { Table, Order, Notification, Theme } from '@/types'

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error'

export function useSocket() {
  const socketRef = useRef<Socket | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const { accessToken, isAuthenticated } = useAuthStore()
  const { updateTable, markNewItem } = useTableStore()
  const { addNotification } = useNotificationStore()
  const { setTheme } = useThemeStore()

  // Render cold start için sabırlı ol — birkaç başarısız denemeden sonra "Hata" göster
  const hasConnectedOnceRef = useRef(false)
  const errorCountRef = useRef(0)
  const ERROR_THRESHOLD = 5  // 5 başarısız denemeden sonra "Hata" göster

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return

    setStatus('connecting')
    hasConnectedOnceRef.current = false
    errorCountRef.current = 0

    const socket = io(CONFIG.SOCKET_BASE, {
      auth:                { token: accessToken },
      transports:          ['websocket', 'polling'],
      reconnection:        true,
      reconnectionDelay:   1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 20,
      randomizationFactor: 0.1,
      autoConnect:         true,
      upgrade:             true,
      rememberUpgrade:     false,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      hasConnectedOnceRef.current = true
      errorCountRef.current = 0
      setStatus('connected')
    })

    socket.on('disconnect', (reason) => {
      // Bir kere bağlandıysak bilinçli kopukluk göster, yoksa "connecting" kal
      setStatus(hasConnectedOnceRef.current ? 'disconnected' : 'connecting')
      if (reason === 'io server disconnect') {
        setTimeout(() => socket.connect(), 2000)
      }
    })

    socket.on('connect_error', () => {
      errorCountRef.current += 1
      // Cold start aşamasında sabırlı ol — eşik geçilene kadar "connecting" göster
      if (hasConnectedOnceRef.current || errorCountRef.current >= ERROR_THRESHOLD) {
        setStatus('error')
      } else {
        setStatus('connecting')
      }
    })

    socket.on('reconnect', () => {
      hasConnectedOnceRef.current = true
      errorCountRef.current = 0
      setStatus('connected')
    })

    socket.on('reconnect_attempt', () => {
      setStatus('connecting')
    })

    socket.on('reconnect_failed', () => {
      setStatus('error')
    })

    // Masa güncellemeleri — backend partial update gönderebilir
    socket.on('table:updated', (data: Partial<Table> & { id: string }) => {
      updateTable(data)
    })

    // Siparişe yeni ürün eklendi
    socket.on('order:item:added', (data: { tableId: string; order: Order }) => {
      markNewItem(data.tableId)
      addNotification({
        type:    'order',
        title:   'Yeni Sipariş Kalemi',
        message: `${data.order.tableName} masasına yeni ürün eklendi`,
        data:    { orderId: data.order.id, tableId: data.tableId },
      })
    })

    // Yeni sipariş açıldı
    socket.on('order:created', (order: Order) => {
      addNotification({
        type:    'order',
        title:   'Sipariş Açıldı',
        message: `${order.tableName} — ${order.waiterName}`,
        data:    { orderId: order.id },
      })
    })

    // Sipariş güncellendi (kapatma / split)
    socket.on('order:updated', (order: Order) => {
      addNotification({
        type:    'info',
        title:   'Sipariş Güncellendi',
        message: `${order.tableName} — ${order.status}`,
        data:    { orderId: order.id },
      })
    })

    socket.on('notification:new', (notification: Notification) => {
      addNotification(notification)
    })

    socket.on('theme:updated', (theme: Theme) => {
      setTheme(theme)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, accessToken])

  const emit = <T = unknown>(event: string, data?: T) => {
    socketRef.current?.emit(event, data)
  }

  const joinTable  = (tableId: string) => emit('table:join',  { tableId })
  const leaveTable = (tableId: string) => emit('table:leave', { tableId })

  return { socket: socketRef.current, status, emit, joinTable, leaveTable }
}
