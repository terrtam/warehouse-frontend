import type { Product, RecordStatus } from '@/domain/wms/types'
import { apiClient } from '@/services/api/client'
import { mockWmsRepository } from './mock-repository'
import type {
  ProductInput,
  ProductRepository,
  WmsRepository,
} from './repository'

type ProductDto = {
  id?: string
  name?: string
  sku?: string
  categoryId?: string
  category_id?: string
  categoryName?: string
  category_name?: string
  category?: {
    id?: string
    name?: string
  } | null
  unit?: string
  defaultSalePrice?: number
  default_sale_price?: number
  costPrice?: number
  cost_price?: number
  reorderThreshold?: number
  reorder_threshold?: number
  status?: string
  version?: number
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
}

type ProductsListResponse = ProductDto[] | { content?: ProductDto[] }

const nowIso = () => new Date().toISOString()

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

const toStatus = (value: unknown): RecordStatus => {
  if (typeof value !== 'string') return 'active'
  return value.toLowerCase() === 'inactive' ? 'inactive' : 'active'
}

const toIsoOrNow = (value: unknown): string =>
  typeof value === 'string' && value.trim() ? value : nowIso()

export const mapProductDto = (dto: ProductDto): Product => {
  const categoryId = dto.categoryId ?? dto.category_id ?? dto.category?.id ?? ''
  const categoryName =
    dto.categoryName ?? dto.category_name ?? dto.category?.name ?? ''

  return {
    id: dto.id ?? '',
    name: dto.name ?? '',
    sku: dto.sku ?? '',
    categoryId,
    categoryName,
    unit: dto.unit ?? '',
    defaultSalePrice: toNumber(dto.defaultSalePrice ?? dto.default_sale_price),
    costPrice: toNumber(dto.costPrice ?? dto.cost_price),
    reorderThreshold: toNumber(dto.reorderThreshold ?? dto.reorder_threshold),
    status: toStatus(dto.status),
    version: toNumber(dto.version),
    createdAt: toIsoOrNow(dto.createdAt ?? dto.created_at),
    updatedAt: toIsoOrNow(dto.updatedAt ?? dto.updated_at),
  }
}

const toProductPayload = (input: ProductInput, expectedVersion?: number) => ({
  name: input.name,
  sku: input.sku,
  categoryId: input.categoryId,
  unit: input.unit,
  defaultSalePrice: input.defaultSalePrice,
  costPrice: input.costPrice,
  reorderThreshold: input.reorderThreshold,
  status: input.status,
  ...(expectedVersion === undefined ? {} : { version: expectedVersion }),
})

export const httpProductsRepository: ProductRepository = {
  async list() {
    const response = await apiClient.get<ProductsListResponse>('/api/products')
    const payload = response.data
    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.content)
        ? payload.content
        : []
    return rows.map((item) => mapProductDto(item))
  },

  async create(input) {
    const response = await apiClient.post<ProductDto>(
      '/api/products',
      toProductPayload(input)
    )
    return mapProductDto(response.data)
  },

  async update(id, input, _actor, expectedVersion) {
    const response = await apiClient.put<ProductDto>(
      `/api/products/${id}`,
      toProductPayload(input, expectedVersion),
      expectedVersion === undefined
        ? undefined
        : {
            headers: {
              'If-Match': String(expectedVersion),
            },
            params: {
              expectedVersion,
            },
          }
    )

    return mapProductDto(response.data)
  },
}

export const httpWmsRepository: WmsRepository = {
  ...mockWmsRepository,
  products: httpProductsRepository,
}
