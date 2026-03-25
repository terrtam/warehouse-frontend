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

import {
  httpCategoriesRepository,
  httpCustomersRepository,
  httpInventoryRepository,
  httpInventoryTransactionsRepository,
  httpPurchaseOrdersRepository,
  httpReportsRepository,
  httpSalesOrdersRepository,
  mapCustomerDto,
  mapProductDto,
  mapSupplierDto,
} from './http-repository'

describe('http repository mappings', () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset()
    put.mockReset()
    del.mockReset()
  })

  it('maps product dto with nested category object', () => {
    const mapped = mapProductDto({
      id: 'prd-1',
      name: 'Scanner',
      sku: 'WH-1001',
      category: {
        id: 'cat-1',
        name: 'Electronics',
      },
      defaultSalePrice: 129.99,
      costPrice: 80,
      reorderThreshold: 10,
      status: 'ACTIVE',
      version: 2,
      createdAt: '2026-02-01T10:00:00.000Z',
      updatedAt: '2026-02-02T10:00:00.000Z',
    })

    expect(mapped.categoryId).toBe('cat-1')
    expect(mapped.categoryName).toBe('Electronics')
    expect(mapped.status).toBe('active')
  })

  it('maps customer and supplier legacy contactInfo payloads', () => {
    const customer = mapCustomerDto({
      id: 'cus-1',
      name: 'Legacy Customer',
      contactInfo: 'legacy@example.com, +1 555 1111',
      status: 'INACTIVE',
      version: 1,
      createdAt: '2026-02-01T10:00:00.000Z',
      updatedAt: '2026-02-01T10:00:00.000Z',
    })
    const supplier = mapSupplierDto({
      id: 'sup-1',
      name: 'Legacy Supplier',
      contactInfo: 'legacy@supplier.example, +1 555 2222',
      status: 'ACTIVE',
      version: 1,
      createdAt: '2026-02-01T10:00:00.000Z',
      updatedAt: '2026-02-01T10:00:00.000Z',
    })

    expect(customer.email).toBe('legacy@example.com')
    expect(customer.phone).toBe('+1 555 1111')
    expect(supplier.email).toBe('legacy@supplier.example')
    expect(supplier.phone).toBe('+1 555 2222')
  })
})

describe('httpCategoriesRepository', () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset()
    put.mockReset()
  })

  it('sends category description and normalized status on create', async () => {
    post.mockResolvedValue({
      data: {
        id: 'cat-1',
        name: 'Electronics',
        description: 'Devices',
        status: 'ACTIVE',
        version: 1,
        createdAt: '2026-02-01T10:00:00.000Z',
        updatedAt: '2026-02-01T10:00:00.000Z',
      },
    })

    await httpCategoriesRepository.create(
      {
        name: 'Electronics',
        description: 'Devices',
        status: 'active',
      },
      { username: 'manager', role: 'manager' }
    )

    expect(post).toHaveBeenCalledWith('/api/categories', {
      name: 'Electronics',
      description: 'Devices',
      status: 'ACTIVE',
    })
  })
})

describe('httpCustomersRepository', () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset()
    put.mockReset()
  })

  it('passes replay params and maps address/notes fields', async () => {
    get.mockResolvedValue({
      data: [
        {
          id: 'cus-1',
          name: 'ACME',
          email: 'buyer@acme.example',
          phone: '+1 555 1000',
          address: '100 Main St',
          notes: 'Priority',
          status: 'ACTIVE',
          version: 3,
          createdAt: '2026-02-01T10:00:00.000Z',
          updatedAt: '2026-02-02T10:00:00.000Z',
        },
      ],
    })

    const rows = await httpCustomersRepository.list({
      updatedAfter: '2026-02-10T10:00:00.000Z',
      page: 0,
      size: 200,
    })

    expect(get).toHaveBeenCalledWith('/api/customers', {
      params: {
        updatedAfter: '2026-02-10T10:00:00.000Z',
        page: 0,
        size: 200,
      },
    })
    expect(rows[0]?.address).toBe('100 Main St')
    expect(rows[0]?.notes).toBe('Priority')
  })
})

describe('order operation repositories', () => {
  beforeEach(() => {
    post.mockReset()
  })

  it('sends version payload for sales-order confirm', async () => {
    post.mockResolvedValue({
      data: {
        id: 'so-1',
        customerId: 'cus-1',
        customerName: 'ACME',
        date: '2026-02-10',
        status: 'PROCESSING',
        version: 2,
        createdAt: '2026-02-10T10:00:00.000Z',
        updatedAt: '2026-02-10T10:00:00.000Z',
        lines: [],
      },
    })

    await httpSalesOrdersRepository.confirm(
      'so-1',
      { username: 'manager', role: 'manager' },
      2
    )

    expect(post).toHaveBeenCalledWith('/api/sales-orders/so-1/confirm', {
      version: 2,
    })
  })

  it('sends version + lines payload for purchase-order receive', async () => {
    post.mockResolvedValue({
      data: {
        id: 'po-1',
        supplierId: 'sup-1',
        supplierName: 'Apex',
        date: '2026-02-10',
        status: 'PARTIALLY_RECEIVED',
        version: 3,
        createdAt: '2026-02-10T10:00:00.000Z',
        updatedAt: '2026-02-10T10:00:00.000Z',
        lines: [],
      },
    })

    await httpPurchaseOrdersRepository.receive(
      'po-1',
      [{ lineId: 'pol-1', quantity: 5 }],
      { username: 'staff', role: 'staff' },
      3
    )

    expect(post).toHaveBeenCalledWith('/api/purchase-orders/po-1/receive', {
      version: 3,
      lines: [{ lineId: 'pol-1', quantity: 5 }],
    })
  })
})

describe('inventory repositories', () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset()
  })

  it('maps inventory on-hand/reserved/available model', async () => {
    get.mockResolvedValue({
      data: [
        {
          productId: 'prd-1',
          productName: 'Scanner',
          sku: 'WH-1001',
          onHand: 10,
          reserved: 4,
          available: 6,
          reorderThreshold: 5,
          lowStock: false,
        },
      ],
    })

    const rows = await httpInventoryRepository.list()

    expect(rows).toEqual([
      {
        productId: 'prd-1',
        productName: 'Scanner',
        sku: 'WH-1001',
        onHand: 10,
        reserved: 4,
        available: 6,
        reorderThreshold: 5,
        lowStock: false,
        currentQuantity: 10,
      },
    ])
  })

  it('maps transaction reason/reference/unit price fields', async () => {
    get.mockResolvedValue({
      data: [
        {
          id: 'txn-1',
          productId: 'prd-1',
          productName: 'Scanner',
          sku: 'WH-1001',
          quantity: 5,
          type: 'ADJUST',
          referenceType: 'ADJUSTMENT',
          referenceId: 'adj-1',
          referenceLineId: 'line-1',
          unitPrice: 9.5,
          reason: 'Cycle count',
          performedByUsername: 'staff',
          version: 1,
          createdAt: '2026-02-12T10:00:00.000Z',
          updatedAt: '2026-02-12T10:00:00.000Z',
        },
      ],
    })

    const rows = await httpInventoryTransactionsRepository.list()

    expect(rows[0]).toMatchObject({
      referenceLineId: 'line-1',
      unitPrice: 9.5,
      reason: 'Cycle count',
      performedByUsername: 'staff',
    })
  })
})

describe('httpReportsRepository', () => {
  beforeEach(() => {
    get.mockReset()
  })

  it('passes date range params to report endpoints', async () => {
    get.mockResolvedValue({ data: [] })

    await httpReportsRepository.salesByProduct({
      from: '2026-02-01',
      to: '2026-02-15',
    })

    expect(get).toHaveBeenCalledWith('/api/reports/sales-by-product', {
      params: {
        from: '2026-02-01',
        to: '2026-02-15',
      },
    })
  })
})
