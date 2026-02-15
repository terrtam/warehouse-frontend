import type {
  RealtimeHandler,
  RealtimeTopic,
  RealtimeTransport,
} from './transport'

type HandlerMap = Map<RealtimeTopic, Set<RealtimeHandler>>

class MockRealtimeTransport implements RealtimeTransport {
  private connected = false
  private handlers: HandlerMap = new Map()

  connect() {
    this.connected = true
  }

  disconnect() {
    this.connected = false
  }

  subscribe<TPayload = unknown>(
    topic: RealtimeTopic,
    handler: RealtimeHandler<TPayload>
  ) {
    const typedHandler = handler as RealtimeHandler
    const existing = this.handlers.get(topic)
    if (existing) {
      existing.add(typedHandler)
    } else {
      this.handlers.set(topic, new Set([typedHandler]))
    }

    return () => {
      const current = this.handlers.get(topic)
      if (!current) return
      current.delete(typedHandler)
      if (current.size === 0) {
        this.handlers.delete(topic)
      }
    }
  }

  publish<TPayload = unknown>(topic: RealtimeTopic, payload: TPayload) {
    if (!this.connected) return
    const handlers = this.handlers.get(topic)
    if (!handlers) return

    handlers.forEach((handler) => {
      handler(payload)
    })
  }
}

export const mockRealtimeTransport = new MockRealtimeTransport()

