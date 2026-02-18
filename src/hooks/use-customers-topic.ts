import { useCallback, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { QueryClient, QueryKey } from '@tanstack/react-query'
import type { Customer } from '@/domain/wms/types'
import { useTopicSubscription } from './use-topic-subscription'
import { realtimeTopics } from '@/services/realtime/transport'
import { stompRealtimeTransport } from '@/services/realtime/stomp-transport'
import { wmsQueryKeys, wmsRepository } from '@/services/wms'

const customerSyncCheckpointKey = 'wms.customers.lastSeenUpdatedAt'

const isIsoDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.trim().length === 0) return false
  return Number.isFinite(Date.parse(value))
}

const toQueryKey = (value: QueryKey) => JSON.stringify(value)

const customersQueryKey = toQueryKey(wmsQueryKeys.customers)

const isCustomersQuery = (value: QueryKey) => toQueryKey(value) === customersQueryKey

const readCheckpoint = () => {
  if (typeof window === 'undefined') return undefined
  const value = window.localStorage.getItem(customerSyncCheckpointKey)
  return isIsoDate(value) ? value : undefined
}

const persistCheckpoint = (value: string | undefined) => {
  if (typeof window === 'undefined') return
  if (!value) return
  window.localStorage.setItem(customerSyncCheckpointKey, value)
}

const toLatestUpdatedAt = (rows: Customer[]) =>
  rows
    .map((row) => row.updatedAt)
    .filter(isIsoDate)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0]

const mergeCustomersById = (current: Customer[], updates: Customer[]) => {
  const byId = new Map(current.map((row) => [row.id, row]))
  updates.forEach((row) => {
    const existing = byId.get(row.id)
    if (!existing || row.version >= existing.version) {
      byId.set(row.id, row)
    }
  })

  return Array.from(byId.values()).sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
  )
}

const toCheckpointFromMessage = (payload: unknown): string | undefined => {
  if (!payload || typeof payload !== 'object') return undefined
  const raw = payload as Record<string, unknown>
  const customer =
    raw.customer && typeof raw.customer === 'object'
      ? (raw.customer as Record<string, unknown>)
      : null
  const candidate =
    customer?.updatedAt ?? customer?.updated_at ?? raw.occurredAt ?? raw.at

  return isIsoDate(candidate) ? candidate : undefined
}

export const invalidateCustomersTopicQueries = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: wmsQueryKeys.customers })
}

const replayMissedCustomers = async (queryClient: QueryClient) => {
  const checkpoint = readCheckpoint()
  if (!checkpoint) {
    invalidateCustomersTopicQueries(queryClient)
    return
  }

  const updates = await wmsRepository.customers.list({
    updatedAfter: checkpoint,
  })

  if (updates.length === 0) return

  const existing = queryClient.getQueryData<Customer[]>(wmsQueryKeys.customers)
  if (!existing) {
    invalidateCustomersTopicQueries(queryClient)
  } else {
    queryClient.setQueryData<Customer[]>(wmsQueryKeys.customers, (current) =>
      mergeCustomersById(current ?? existing, updates)
    )
  }

  persistCheckpoint(toLatestUpdatedAt(updates))
}

export const useCustomersTopic = () => {
  const queryClient = useQueryClient()

  const onMessage = useCallback(
    (payload: unknown) => {
      persistCheckpoint(toCheckpointFromMessage(payload))
      invalidateCustomersTopicQueries(queryClient)
    },
    [queryClient]
  )

  useTopicSubscription(realtimeTopics.customers, onMessage)

  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (!event?.query || !isCustomersQuery(event.query.queryKey)) return
      const rows = event.query.state.data
      if (!Array.isArray(rows)) return
      const typedRows = rows as Customer[]
      persistCheckpoint(toLatestUpdatedAt(typedRows))
    })

    return unsubscribe
  }, [queryClient])

  useEffect(() => {
    const replay = () => {
      void replayMissedCustomers(queryClient).catch(() => {
        invalidateCustomersTopicQueries(queryClient)
      })
    }

    replay()
    const unsubscribeConnected = stompRealtimeTransport.onConnected(replay)

    return () => {
      unsubscribeConnected()
    }
  }, [queryClient])
}
