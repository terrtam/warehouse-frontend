import { useEffect } from 'react'
import { mockRealtimeTransport } from '@/services/realtime/mock-transport'
import type { RealtimeTopic } from '@/services/realtime/transport'

export const useTopicSubscription = (
  topic: RealtimeTopic,
  onMessage: (payload: unknown) => void
) => {
  useEffect(() => {
    const unsubscribe = mockRealtimeTransport.subscribe(topic, onMessage)
    return unsubscribe
  }, [topic, onMessage])
}

