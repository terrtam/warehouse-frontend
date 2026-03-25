import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { useTopicSubscription } from './use-topic-subscription'
import { realtimeTopics } from '@/services/realtime/transport'
import { wmsQueryKeys } from '@/services/wms'

export const invalidateCategoriesTopicQueries = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: wmsQueryKeys.categories })
  queryClient.invalidateQueries({ queryKey: wmsQueryKeys.products })
}

export const useCategoriesTopic = () => {
  const queryClient = useQueryClient()
  const onMessage = useCallback(() => {
    invalidateCategoriesTopicQueries(queryClient)
  }, [queryClient])

  useTopicSubscription(realtimeTopics.categories, onMessage)
}
