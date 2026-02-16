import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WmsError } from './errors'

const { get, post, put } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}))

vi.mock('@/services/api/client', () => ({
  apiClient: {
    get,
    post,
    put,
  },
}))

import { httpProductsRepository, mapProductDto } from './http-repository'

describe('httpProductsRepository', () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset()
    put.mockReset()
  })

  it('maps list response from backend dto into Product model', async () => {
    get.mockResolvedValue({
      data: [
        {
          id: 'prd-1',
          name: 'Barcode Scanner',
          sku: 'WH-1001',
          category_id: 'cat-1',
          category_name: 'Electronics',
          unit: 'pcs',
          default_sale_price: 149.99,
          cost_price: 90,
          reorder_threshold: 12,
          status: 'ACTIVE',
          version: 7,
          created_at: '2026-02-01T10:00:00.000Z',
          updated_at: '2026-02-02T10:00:00.000Z',
        },
      ],
    })

    const rows = await httpProductsRepository.list()

    expect(rows).toEqual([
      {
        id: 'prd-1',
        name: 'Barcode Scanner',
        sku: 'WH-1001',
        categoryId: 'cat-1',
        categoryName: 'Electronics',
        unit: 'pcs',
        defaultSalePrice: 149.99,
        costPrice: 90,
        reorderThreshold: 12,
        status: 'active',
        version: 7,
        createdAt: '2026-02-01T10:00:00.000Z',
        updatedAt: '2026-02-02T10:00:00.000Z',
      },
    ])
  })

  it('maps paged list response using content array', async () => {
    get.mockResolvedValue({
      data: {
        content: [
          {
            id: 'prd-10',
            name: 'Green Apple',
            sku: 'AP-GRN-ORG',
            defaultSalePrice: 5,
            version: 1,
          },
        ],
      },
    })

    const rows = await httpProductsRepository.list()

    expect(rows).toEqual([
      expect.objectContaining({
        id: 'prd-10',
        name: 'Green Apple',
        sku: 'AP-GRN-ORG',
        defaultSalePrice: 5,
        version: 1,
      }),
    ])
  })

  it('sends expected optimistic concurrency metadata for updates', async () => {
    put.mockResolvedValue({
      data: {
        id: 'prd-2',
        name: 'Label Printer',
        sku: 'WH-1002',
        categoryId: 'cat-2',
        categoryName: 'Operations',
        unit: 'pcs',
        defaultSalePrice: 300,
        costPrice: 210,
        reorderThreshold: 8,
        status: 'inactive',
        version: 11,
        createdAt: '2026-02-01T10:00:00.000Z',
        updatedAt: '2026-02-03T10:00:00.000Z',
      },
    })

    await httpProductsRepository.update(
      'prd-2',
      {
        name: 'Label Printer',
        sku: 'WH-1002',
        categoryId: 'cat-2',
        unit: 'pcs',
        defaultSalePrice: 300,
        costPrice: 210,
        reorderThreshold: 8,
        status: 'inactive',
      },
      {
        username: 'manager',
        role: 'manager',
      },
      10
    )

    expect(put).toHaveBeenCalledWith(
      '/api/products/prd-2',
      expect.objectContaining({
        version: 10,
      }),
      {
        headers: {
          'If-Match': '10',
        },
        params: {
          expectedVersion: 10,
        },
      }
    )
  })

  it('preserves normalized WMS errors for callers', async () => {
    const conflictError = new WmsError(
      'CONFLICT',
      'Record has been changed by another user'
    )
    post.mockRejectedValue(conflictError)

    await expect(
      httpProductsRepository.create(
        {
          name: 'Scale',
          sku: 'WH-3001',
          categoryId: 'cat-1',
          unit: 'pcs',
          defaultSalePrice: 50,
          costPrice: 30,
          reorderThreshold: 3,
          status: 'active',
        },
        {
          username: 'manager',
          role: 'manager',
        }
      )
    ).rejects.toBe(conflictError)
  })
})

describe('mapProductDto', () => {
  it('supports nested category payloads', () => {
    const mapped = mapProductDto({
      id: 'prd-3',
      name: 'Tape',
      sku: 'WH-5001',
      category: {
        id: 'cat-5',
        name: 'Packing',
      },
      unit: 'roll',
      defaultSalePrice: 2.5,
      costPrice: 1,
      reorderThreshold: 40,
      status: 'inactive',
      version: 1,
      createdAt: '2026-02-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
    })

    expect(mapped.categoryId).toBe('cat-5')
    expect(mapped.categoryName).toBe('Packing')
    expect(mapped.status).toBe('inactive')
  })
})
