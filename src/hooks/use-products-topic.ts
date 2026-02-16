import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { useTopicSubscription } from './use-topic-subscription'
import { realtimeTopics } from '@/services/realtime/transport'
import { wmsQueryKeys } from '@/services/wms'

export const invalidateProductsTopicQueries = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: wmsQueryKeys.products })
  queryClient.invalidateQueries({ queryKey: wmsQueryKeys.inventory })
  queryClient.invalidateQueries({ queryKey: wmsQueryKeys.salesOrders })
  queryClient.invalidateQueries({ queryKey: wmsQueryKeys.purchaseOrders })
}

export const useProductsTopic = () => {
  const queryClient = useQueryClient()
  const onMessage = useCallback(() => {
    invalidateProductsTopicQueries(queryClient)
  }, [queryClient])

  useTopicSubscription(realtimeTopics.products, onMessage)
}
