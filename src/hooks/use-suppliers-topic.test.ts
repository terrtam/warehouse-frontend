import { describe, expect, it, vi } from 'vitest'
import { wmsQueryKeys } from '@/services/wms'
import { invalidateSuppliersTopicQueries } from './use-suppliers-topic'

describe('invalidateSuppliersTopicQueries', () => {
  it('invalidates suppliers query key on topic message', () => {
    const queryClient = {
      invalidateQueries: vi.fn(),
    }

    invalidateSuppliersTopicQueries(queryClient as never)

    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(1)
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: wmsQueryKeys.suppliers,
    })
  })
})
