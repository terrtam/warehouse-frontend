import { useEffect } from 'react'
import { useCategoriesTopic } from '@/hooks/use-categories-topic'
import { useCommunicationsTopic } from '@/hooks/use-communications-topic'
import { useCustomersTopic } from '@/hooks/use-customers-topic'
import { useInventoryTopic } from '@/hooks/use-inventory-topic'
import { useOrdersTopic } from '@/hooks/use-orders-topic'
import { useProductsTopic } from '@/hooks/use-products-topic'
import { useSuppliersTopic } from '@/hooks/use-suppliers-topic'
import { stompRealtimeTransport } from '@/services/realtime/stomp-transport'

export function RealtimeSyncBoundary() {
  useEffect(() => {
    stompRealtimeTransport.connect()
    return () => {
      stompRealtimeTransport.disconnect()
    }
  }, [])

  useCategoriesTopic()
  useProductsTopic()
  useInventoryTopic()
  useOrdersTopic()
  useCustomersTopic()
  useSuppliersTopic()
  useCommunicationsTopic()

  return null
}
