import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { useTopicSubscription } from './use-topic-subscription'
import { realtimeTopics } from '@/services/realtime/transport'
import { wmsQueryKeys } from '@/services/wms'

export const invalidateSuppliersTopicQueries = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: wmsQueryKeys.suppliers })
}

export const useSuppliersTopic = () => {
  const queryClient = useQueryClient()
  const onMessage = useCallback(() => {
    invalidateSuppliersTopicQueries(queryClient)
  }, [queryClient])

  useTopicSubscription(realtimeTopics.suppliers, onMessage)
}
