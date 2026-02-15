import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTopicSubscription } from './use-topic-subscription'
import { realtimeTopics } from '@/services/realtime/transport'
import { wmsQueryKeys } from '@/services/wms'

export const useInventoryTopic = () => {
  const queryClient = useQueryClient()
  const onMessage = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: wmsQueryKeys.inventory })
    queryClient.invalidateQueries({ queryKey: wmsQueryKeys.inventoryTransactions })
  }, [queryClient])

  useTopicSubscription(realtimeTopics.inventory, onMessage)
}

