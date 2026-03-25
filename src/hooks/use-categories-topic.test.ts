import { describe, expect, it, vi } from 'vitest'
import { wmsQueryKeys } from '@/services/wms'
import { invalidateCategoriesTopicQueries } from './use-categories-topic'

describe('invalidateCategoriesTopicQueries', () => {
  it('invalidates categories and products query keys on topic message', () => {
    const queryClient = {
      invalidateQueries: vi.fn(),
    }

    invalidateCategoriesTopicQueries(queryClient as never)

    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(2)
    expect(queryClient.invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: wmsQueryKeys.categories,
    })
    expect(queryClient.invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: wmsQueryKeys.products,
    })
  })
})
