import { describe, expect, it, vi } from 'vitest'
import { StompRealtimeTransport } from './stomp-transport'
import { realtimeTopics } from './transport'

const createFakeClient = () => {
  let messageHandler: ((message: { body: string }) => void) | null = null
  const unsubscribeSpy = vi.fn()

  const client = {
    connected: false,
    onConnect: undefined as ((frame: unknown) => void) | undefined,
    onWebSocketClose: undefined as ((event: unknown) => void) | undefined,
    activate: vi.fn(() => {
      client.connected = true
      client.onConnect?.({})
    }),
    deactivate: vi.fn(async () => {
      client.connected = false
    }),
    subscribe: vi.fn(
      (_destination: string, callback: (message: { body: string }) => void) => {
        messageHandler = callback
        return {
          unsubscribe: unsubscribeSpy,
        }
      }
    ),
    publish: vi.fn(),
    emit: (payload: unknown) => {
      messageHandler?.({ body: JSON.stringify(payload) })
    },
    closeSocket: () => {
      client.connected = false
      client.onWebSocketClose?.({})
    },
    unsubscribeSpy,
  }

  return client
}

describe('StompRealtimeTransport', () => {
  it('subscribes and unsubscribes handlers', () => {
    const fakeClient = createFakeClient()
    const transport = new StompRealtimeTransport(() => fakeClient)
    const handler = vi.fn()

    transport.connect()
    const unsubscribe = transport.subscribe(realtimeTopics.products, handler)

    expect(fakeClient.subscribe).toHaveBeenCalledTimes(1)

    unsubscribe()
    expect(fakeClient.unsubscribeSpy).toHaveBeenCalledTimes(1)
  })

  it('parses JSON messages and forwards to topic handlers', () => {
    const fakeClient = createFakeClient()
    const transport = new StompRealtimeTransport(() => fakeClient)
    const handler = vi.fn()

    transport.connect()
    transport.subscribe(realtimeTopics.products, handler)
    fakeClient.emit({
      type: 'product.updated',
      id: 'prd-1',
      version: 2,
      at: '2026-02-15T12:00:00.000Z',
    })

    expect(handler).toHaveBeenCalledWith({
      type: 'product.updated',
      id: 'prd-1',
      version: 2,
      at: '2026-02-15T12:00:00.000Z',
    })
  })

  it('re-subscribes handlers after socket reconnect events', () => {
    const fakeClient = createFakeClient()
    const transport = new StompRealtimeTransport(() => fakeClient)
    const handler = vi.fn()

    transport.connect()
    transport.subscribe(realtimeTopics.products, handler)
    expect(fakeClient.subscribe).toHaveBeenCalledTimes(1)

    fakeClient.closeSocket()
    fakeClient.connected = true
    fakeClient.onConnect?.({})

    expect(fakeClient.subscribe).toHaveBeenCalledTimes(2)
  })

  it('keeps existing query params when appending access token', () => {
    const value = ((
      url: string,
      token?: string
    ) => {
      const separator = url.includes('?') ? '&' : '?'
      return `${url}${separator}access_token=${encodeURIComponent(token ?? '')}`
    })('http://localhost:8080/ws?foo=bar', 'abc')

    expect(value).toBe('http://localhost:8080/ws?foo=bar&access_token=abc')
  })
})
