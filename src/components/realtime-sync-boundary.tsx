import { useEffect } from 'react'
import { useInventoryTopic } from '@/hooks/use-inventory-topic'
import { useOrdersTopic } from '@/hooks/use-orders-topic'
import { useProductsTopic } from '@/hooks/use-products-topic'
import { mockRealtimeTransport } from '@/services/realtime/mock-transport'

export function RealtimeSyncBoundary() {
  useEffect(() => {
    mockRealtimeTransport.connect()
    return () => {
      mockRealtimeTransport.disconnect()
    }
  }, [])

  useProductsTopic()
  useInventoryTopic()
  useOrdersTopic()

  return null
}

