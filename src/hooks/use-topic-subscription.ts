import { useEffect } from 'react'
import { stompRealtimeTransport } from '@/services/realtime/stomp-transport'
import type { RealtimeTopic } from '@/services/realtime/transport'

export const useTopicSubscription = (
  topic: RealtimeTopic,
  onMessage: (payload: unknown) => void
) => {
  useEffect(() => {
    const unsubscribe = stompRealtimeTransport.subscribe(topic, onMessage)
    return unsubscribe
  }, [topic, onMessage])
}
