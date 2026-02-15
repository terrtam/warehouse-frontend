export type RealtimeTopic =
  | '/topic/products'
  | '/topic/inventory'
  | '/topic/orders'

export type RealtimeHandler<TPayload = unknown> = (payload: TPayload) => void

export interface RealtimeTransport {
  connect(): void
  disconnect(): void
  subscribe<TPayload = unknown>(
    topic: RealtimeTopic,
    handler: RealtimeHandler<TPayload>
  ): () => void
  publish<TPayload = unknown>(topic: RealtimeTopic, payload: TPayload): void
}

export const realtimeTopics = {
  products: '/topic/products',
  inventory: '/topic/inventory',
  orders: '/topic/orders',
} as const

