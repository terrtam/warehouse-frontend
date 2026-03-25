import { describe, expect, it, vi } from 'vitest'
import { wmsQueryKeys } from '@/services/wms'
import { invalidateProductsTopicQueries } from './use-products-topic'

describe('invalidateProductsTopicQueries', () => {
  it('invalidates all product-related query keys on topic message', () => {
    const queryClient = {
      invalidateQueries: vi.fn(),
    }

    invalidateProductsTopicQueries(queryClient as never)

    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(5)
    expect(queryClient.invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: wmsQueryKeys.categories,
    })
    expect(queryClient.invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: wmsQueryKeys.products,
    })
    expect(queryClient.invalidateQueries).toHaveBeenNthCalledWith(3, {
      queryKey: wmsQueryKeys.inventory,
    })
    expect(queryClient.invalidateQueries).toHaveBeenNthCalledWith(4, {
      queryKey: wmsQueryKeys.salesOrders,
    })
    expect(queryClient.invalidateQueries).toHaveBeenNthCalledWith(5, {
      queryKey: wmsQueryKeys.purchaseOrders,
    })
  })
})
