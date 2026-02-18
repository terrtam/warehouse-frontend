import { describe, expect, it, vi } from 'vitest'
import { wmsQueryKeys } from '@/services/wms'
import { invalidateCustomersTopicQueries } from './use-customers-topic'

describe('invalidateCustomersTopicQueries', () => {
  it('invalidates customers query key on topic message', () => {
    const queryClient = {
      invalidateQueries: vi.fn(),
    }

    invalidateCustomersTopicQueries(queryClient as never)

    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(1)
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: wmsQueryKeys.customers,
    })
  })
})

