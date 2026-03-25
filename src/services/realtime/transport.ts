export type RealtimeTopic =
  | '/topic/products'
  | '/topic/categories'
  | '/topic/inventory'
  | '/topic/orders'
  | '/topic/customers'
  | '/topic/suppliers'
  | '/topic/communications'

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
  categories: '/topic/categories',
  inventory: '/topic/inventory',
  orders: '/topic/orders',
  customers: '/topic/customers',
  suppliers: '/topic/suppliers',
  communications: '/topic/communications',
} as const
