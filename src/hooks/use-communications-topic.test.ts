import { describe, expect, it, vi } from 'vitest'
import { wmsQueryKeys } from '@/services/wms'
import { invalidateCommunicationsTopicQueries } from './use-communications-topic'

describe('invalidateCommunicationsTopicQueries', () => {
  it('invalidates communications query key on topic message', () => {
    const queryClient = {
      invalidateQueries: vi.fn(),
    }

    invalidateCommunicationsTopicQueries(queryClient as never)

    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(1)
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: wmsQueryKeys.communications,
    })
  })
})
