import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTopicSubscription } from './use-topic-subscription'
import { realtimeTopics } from '@/services/realtime/transport'
import { wmsQueryKeys } from '@/services/wms'

export const useOrdersTopic = () => {
  const queryClient = useQueryClient()
  const onMessage = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: wmsQueryKeys.salesOrders })
    queryClient.invalidateQueries({ queryKey: wmsQueryKeys.purchaseOrders })
    queryClient.invalidateQueries({ queryKey: wmsQueryKeys.inventory })
    queryClient.invalidateQueries({ queryKey: wmsQueryKeys.inventoryTransactions })
    queryClient.invalidateQueries({ queryKey: wmsQueryKeys.communications })
  }, [queryClient])

  useTopicSubscription(realtimeTopics.orders, onMessage)
}
