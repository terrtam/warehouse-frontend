import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { useAuthStore } from '@/stores/auth-store'
import type {
  RealtimeHandler,
  RealtimeTopic,
  RealtimeTransport,
} from './transport'

type SubscriptionLike = {
  unsubscribe: () => void
}

type MessageLike = {
  body: string
}

type StompClientLike = {
  activate: () => void
  deactivate: () => Promise<void>
  subscribe: (
    destination: string,
    callback: (message: MessageLike) => void
  ) => SubscriptionLike
  publish: (params: { destination: string; body: string }) => void
  connected: boolean
  onConnect?: ((frame: any) => void) | undefined
  onWebSocketClose?: ((event: any) => void) | undefined
}

const parseMessageBody = (body: string): unknown => {
  if (!body) return undefined
  try {
    return JSON.parse(body)
  } catch {
    return body
  }
}

const defaultWsUrl = 'http://localhost:8080/ws'

const resolveWsUrl = (value: unknown): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return defaultWsUrl
  }
  return value
}

const toBrokerUrl = (value: string) => {
  if (value.startsWith('ws://') || value.startsWith('wss://')) return value
  if (value.startsWith('https://')) return value.replace('https://', 'wss://')
  if (value.startsWith('http://')) return value.replace('http://', 'ws://')
  return value
}

const getAuthorization = () => {
  const token = useAuthStore.getState().auth.accessToken
  if (!token) return undefined
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`
}

const getRawToken = () => {
  const token = useAuthStore.getState().auth.accessToken
  if (!token) return undefined
  return token.startsWith('Bearer ') ? token.slice('Bearer '.length) : token
}

const appendAuthorizationQuery = (url: string, token?: string) => {
  if (!token) return url

  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}access_token=${encodeURIComponent(token)}`
}

const createStompClient = (): StompClientLike => {
  const wsUrl = resolveWsUrl(import.meta.env.VITE_WS_URL)
  const authorization = getAuthorization()
  const rawToken = getRawToken()

  const connectHeaders =
    authorization === undefined ? undefined : { Authorization: authorization }

  if (wsUrl.startsWith('http://') || wsUrl.startsWith('https://')) {
    const sockJsUrl = appendAuthorizationQuery(wsUrl, rawToken)
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug('[ws] create sockjs client', {
        wsUrl,
        hasAuthorization: Boolean(authorization),
        tokenLength: rawToken?.length ?? 0,
      })
    }

    return new Client({
      reconnectDelay: 5000,
      connectHeaders,
      webSocketFactory: () => new SockJS(sockJsUrl),
    })
  }

  return new Client({
    brokerURL: toBrokerUrl(wsUrl),
    reconnectDelay: 5000,
    connectHeaders,
  })
}

export class StompRealtimeTransport implements RealtimeTransport {
  private client: StompClientLike | null = null
  private handlers = new Map<
    RealtimeTopic,
    Map<RealtimeHandler, SubscriptionLike | null>
  >()
  private connectHandlers = new Set<() => void>()

  constructor(private readonly clientFactory: () => StompClientLike = createStompClient) {}

  connect() {
    if (this.client) return

    const client = this.clientFactory()
    client.onConnect = () => {
      this.attachPendingSubscriptions()
      this.connectHandlers.forEach((handler) => {
        handler()
      })
    }
    client.onWebSocketClose = () => {
      this.markSubscriptionsPending()
    }

    this.client = client
    client.activate()
  }

  onConnected(handler: () => void) {
    this.connectHandlers.add(handler)
    return () => {
      this.connectHandlers.delete(handler)
    }
  }

  disconnect() {
    if (!this.client) return
    const client = this.client
    this.unsubscribeAll()
    this.client = null
    void client.deactivate()
  }

  subscribe<TPayload = unknown>(
    topic: RealtimeTopic,
    handler: RealtimeHandler<TPayload>
  ) {
    const typedHandler = handler as RealtimeHandler
    const current = this.handlers.get(topic) ?? new Map()
    this.handlers.set(topic, current)

    if (!current.has(typedHandler)) {
      current.set(typedHandler, this.createSubscription(topic, typedHandler))
    }

    return () => {
      this.unsubscribe(topic, typedHandler)
    }
  }

  publish<TPayload = unknown>(topic: RealtimeTopic, payload: TPayload) {
    if (!this.client || !this.client.connected) return
    this.client.publish({
      destination: topic,
      body: JSON.stringify(payload),
    })
  }

  private createSubscription(topic: RealtimeTopic, handler: RealtimeHandler) {
    if (!this.client || !this.client.connected) return null
    return this.client.subscribe(topic, (message) => {
      handler(parseMessageBody(message.body))
    })
  }

  private unsubscribe(topic: RealtimeTopic, handler: RealtimeHandler) {
    const topicHandlers = this.handlers.get(topic)
    if (!topicHandlers) return

    const subscription = topicHandlers.get(handler)
    subscription?.unsubscribe()
    topicHandlers.delete(handler)

    if (topicHandlers.size === 0) {
      this.handlers.delete(topic)
    }
  }

  private unsubscribeAll() {
    this.handlers.forEach((topicHandlers) => {
      topicHandlers.forEach((subscription) => {
        subscription?.unsubscribe()
      })
    })
  }

  private markSubscriptionsPending() {
    this.handlers.forEach((topicHandlers) => {
      topicHandlers.forEach((_subscription, handler) => {
        topicHandlers.set(handler, null)
      })
    })
  }

  private attachPendingSubscriptions() {
    this.handlers.forEach((topicHandlers, topic) => {
      topicHandlers.forEach((subscription, handler) => {
        if (subscription) return
        topicHandlers.set(handler, this.createSubscription(topic, handler))
      })
    })
  }
}

export const stompRealtimeTransport = new StompRealtimeTransport()
