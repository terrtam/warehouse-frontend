import { useEffect } from 'react'
import { useInventoryTopic } from '@/hooks/use-inventory-topic'
import { useOrdersTopic } from '@/hooks/use-orders-topic'
import { useProductsTopic } from '@/hooks/use-products-topic'
import { stompRealtimeTransport } from '@/services/realtime/stomp-transport'

export function RealtimeSyncBoundary() {
  useEffect(() => {
    stompRealtimeTransport.connect()
    return () => {
      stompRealtimeTransport.disconnect()
    }
  }, [])

  useProductsTopic()
  useInventoryTopic()
  useOrdersTopic()

  return null
}
