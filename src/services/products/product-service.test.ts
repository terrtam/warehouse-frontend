import { beforeEach, describe, expect, it, vi } from 'vitest'

const { get, post, put, del } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}))

vi.mock('@/services/api/client', () => ({
  apiClient: {
    get,
    post,
    put,
    delete: del,
  },
}))

import { productService } from './product-service'

describe('productService payload mapping', () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset()
    put.mockReset()
    del.mockReset()
  })

  it('normalizes categoryId "null" to null and uppercases status on create', async () => {
    post.mockResolvedValue({
      data: {
        id: 'prd-1',
        name: 'A',
        sku: 'S1',
        categoryId: null,
        categoryName: '',
        unit: 'pcs',
        defaultSalePrice: 10,
        costPrice: 5,
        reorderThreshold: 1,
        status: 'ACTIVE',
        version: 0,
      },
    })

    await productService.createProduct({
      name: 'A',
      sku: 'S1',
      categoryId: 'null',
      categoryName: '',
      unit: 'pcs',
      defaultSalePrice: 10,
      costPrice: 5,
      reorderThreshold: 1,
      status: 'active',
      version: 0,
    })

    const payload = post.mock.calls[0][1] as Record<string, unknown>
    expect(payload.categoryId).toBeNull()
    expect(payload.status).toBe('ACTIVE')
  })

  it('normalizes empty categoryId to null and uppercases inactive status on update', async () => {
    put.mockResolvedValue({
      data: {
        id: 'prd-2',
        name: 'B',
        sku: 'S2',
        categoryId: null,
        categoryName: '',
        unit: 'pcs',
        defaultSalePrice: 20,
        costPrice: 11,
        reorderThreshold: 2,
        status: 'INACTIVE',
        version: 2,
      },
    })

    await productService.updateProduct('prd-2', {
      name: 'B',
      sku: 'S2',
      categoryId: '',
      categoryName: '',
      unit: 'pcs',
      defaultSalePrice: 20,
      costPrice: 11,
      reorderThreshold: 2,
      status: 'inactive',
      version: 2,
    })

    const payload = put.mock.calls[0][1] as Record<string, unknown>
    expect(payload.categoryId).toBeNull()
    expect(payload.status).toBe('INACTIVE')
  })

  it('does not send snake_case fields', async () => {
    post.mockResolvedValue({
      data: {
        id: 'prd-3',
        name: 'C',
        sku: 'S3',
        categoryId: 'cat-1',
        categoryName: 'Fruit',
        unit: 'pcs',
        defaultSalePrice: 5,
        costPrice: 3,
        reorderThreshold: 1,
        status: 'ACTIVE',
        version: 0,
      },
    })

    await productService.createProduct({
      name: 'C',
      sku: 'S3',
      categoryId: 'cat-1',
      categoryName: 'Fruit',
      unit: 'pcs',
      defaultSalePrice: 5,
      costPrice: 3,
      reorderThreshold: 1,
      status: 'active',
      version: 0,
    })

    const payload = post.mock.calls[0][1] as Record<string, unknown>
    expect(payload).not.toHaveProperty('category_id')
    expect(payload).not.toHaveProperty('default_sale_price')
    expect(payload).not.toHaveProperty('cost_price')
    expect(payload).not.toHaveProperty('reorder_threshold')
  })

  it('normalizes non-UUID categoryId values to null', async () => {
    put.mockResolvedValue({
      data: {
        id: 'prd-4',
        name: 'D',
        sku: 'S4',
        categoryId: null,
        categoryName: '',
        unit: 'pcs',
        defaultSalePrice: 8,
        costPrice: 4,
        reorderThreshold: 2,
        status: 'ACTIVE',
        version: 3,
      },
    })

    await productService.updateProduct('prd-4', {
      name: 'D',
      sku: 'S4',
      categoryId: 'cat-electronics',
      categoryName: 'Electronics',
      unit: 'pcs',
      defaultSalePrice: 8,
      costPrice: 4,
      reorderThreshold: 2,
      status: 'active',
      version: 3,
    })

    const payload = put.mock.calls[0][1] as Record<string, unknown>
    expect(payload.categoryId).toBeNull()
  })
})
