import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { CONFIG } from '@/config'
import { signPayload, verifySignature } from '@/utils/hmac'
import { generateId } from '@/utils/format'
import client from '@/api/client'
import type { QueueItem, QueueActionType } from '@/types'

export function useOfflineQueue() {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [isSyncing, setIsSyncing] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load queue from storage
  useEffect(() => {
    const stored = localStorage.getItem(CONFIG.OFFLINE_QUEUE_KEY)
    if (stored) {
      try {
        setQueue(JSON.parse(stored))
      } catch {
        localStorage.removeItem(CONFIG.OFFLINE_QUEUE_KEY)
      }
    }
  }, [])

  // Save queue to storage
  useEffect(() => {
    localStorage.setItem(CONFIG.OFFLINE_QUEUE_KEY, JSON.stringify(queue))
  }, [queue])

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      toast.success('Bağlantı yeniden kuruldu. Senkronize ediliyor...')
      syncQueue()
    }
    const handleOffline = () => {
      setIsOnline(false)
      toast.error('Bağlantı kesildi. Offline modda devam ediliyor.')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [queue])

  // Periodic sync attempt
  useEffect(() => {
    syncIntervalRef.current = setInterval(() => {
      if (isOnline && queue.length > 0) syncQueue()
    }, CONFIG.OFFLINE_RETRY_INTERVAL)

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current)
    }
  }, [isOnline, queue])

  const enqueue = async (type: QueueActionType, payload: Record<string, unknown>) => {
    const hmac = await signPayload(payload)
    const item: QueueItem = {
      id: generateId(),
      type,
      payload,
      hmac,
      createdAt: new Date().toISOString(),
      retries: 0,
    }
    setQueue((prev) => [...prev, item])
    return item.id
  }

  const syncQueue = async () => {
    if (isSyncing || queue.length === 0) return
    setIsSyncing(true)

    const processed: string[] = []
    const failed: string[] = []

    for (const item of queue) {
      try {
        // Verify HMAC before sending
        const isValid = await verifySignature(item.payload, item.hmac)
        if (!isValid) {
          console.warn('Invalid HMAC for queue item', item.id)
          failed.push(item.id)
          continue
        }

        await client.post('/sync/queue', {
          id: item.id,
          type: item.type,
          payload: item.payload,
          hmac: item.hmac,
          createdAt: item.createdAt,
        })
        processed.push(item.id)
      } catch {
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, retries: q.retries + 1 } : q
          )
        )
        if (item.retries >= 5) failed.push(item.id)
      }
    }

    setQueue((prev) =>
      prev.filter((q) => !processed.includes(q.id) && !failed.includes(q.id))
    )

    if (processed.length > 0) {
      toast.success(`${processed.length} işlem senkronize edildi`)
    }

    setIsSyncing(false)
  }

  const clearQueue = () => {
    setQueue([])
    localStorage.removeItem(CONFIG.OFFLINE_QUEUE_KEY)
  }

  return { queue, isOnline, isSyncing, enqueue, syncQueue, clearQueue }
}
