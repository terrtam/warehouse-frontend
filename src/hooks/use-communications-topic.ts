import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { useTopicSubscription } from './use-topic-subscription'
import { realtimeTopics } from '@/services/realtime/transport'
import { wmsQueryKeys } from '@/services/wms'

export const invalidateCommunicationsTopicQueries = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: wmsQueryKeys.communications })
}

export const useCommunicationsTopic = () => {
  const queryClient = useQueryClient()
  const onMessage = useCallback(() => {
    invalidateCommunicationsTopicQueries(queryClient)
  }, [queryClient])

  useTopicSubscription(realtimeTopics.communications, onMessage)
}
