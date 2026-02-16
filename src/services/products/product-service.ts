import { apiClient } from '@/services/api/client'

export type ProductDto = {
  id: string | number
  name: string
  sku: string
  categoryId: string
  categoryName: string
  unit: string
  defaultSalePrice: number
  costPrice: number
  reorderThreshold: number
  status: 'active' | 'inactive'
  version: number
}

export type ProductPayload = Omit<ProductDto, 'id'>

const toNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

const toString = (value: unknown) => {
  if (typeof value !== 'string') return ''
  return value
}

const toStatus = (value: unknown): 'active' | 'inactive' => {
  if (typeof value !== 'string') return 'active'
  return value.toLowerCase() === 'inactive' ? 'inactive' : 'active'
}

const firstDefined = (...values: unknown[]): unknown => {
  for (const value of values) {
    if (value !== undefined && value !== null) return value
  }
  return undefined
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const normalizeCategoryId = (value: string): string | null => {
  const trimmed = value.trim()
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null
  return uuidPattern.test(trimmed) ? trimmed : null
}

const toId = (value: unknown): string | number => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.length === 0) return ''

    const parsed = Number(trimmed)
    if (Number.isFinite(parsed)) {
      return parsed > 0 ? parsed : ''
    }

    return trimmed
  }
  return ''
}

const unwrapPayload = (value: unknown): unknown => {
  if (!value || typeof value !== 'object') return value
  const raw = value as Record<string, unknown>
  if ('data' in raw && raw.data !== undefined) {
    return raw.data
  }
  return value
}

const toArrayPayload = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== 'object') return []

  const raw = value as Record<string, unknown>
  const candidates = ['content', 'items', 'results', 'rows']
  for (const key of candidates) {
    const candidate = raw[key]
    if (Array.isArray(candidate)) return candidate
  }

  return []
}

const mapProduct = (value: unknown): ProductDto => {
  if (!value || typeof value !== 'object') {
    return {
      id: '',
      name: '',
      sku: '',
      categoryId: '',
      categoryName: '',
      unit: '',
      defaultSalePrice: 0,
      costPrice: 0,
      reorderThreshold: 0,
      status: 'active',
      version: 0,
    }
  }

  const raw = value as Record<string, unknown>
  const rawId = raw.id ?? raw.productId ?? raw.product_id

  return {
    id: toId(rawId),
    name: toString(raw.name),
    sku: toString(raw.sku),
    categoryId: toString(firstDefined(raw.categoryId, raw.category_id)),
    categoryName: toString(firstDefined(raw.categoryName, raw.category_name)),
    unit: toString(raw.unit),
    defaultSalePrice: toNumber(
      firstDefined(raw.defaultSalePrice, raw.default_sale_price, raw.price)
    ),
    costPrice: toNumber(firstDefined(raw.costPrice, raw.cost_price)),
    reorderThreshold: toNumber(
      firstDefined(raw.reorderThreshold, raw.reorder_threshold)
    ),
    status: toStatus(raw.status),
    version: toNumber(raw.version),
  }
}

const toBackendPayload = (product: ProductPayload) => {
  const normalizedCategoryId = normalizeCategoryId(product.categoryId)

  const normalizedStatus = product.status === 'inactive' ? 'INACTIVE' : 'ACTIVE'

  return {
    name: product.name,
    sku: product.sku,
    categoryId: normalizedCategoryId,
    categoryName: product.categoryName,
    unit: product.unit,
    defaultSalePrice: product.defaultSalePrice,
    costPrice: product.costPrice,
    reorderThreshold: product.reorderThreshold,
    status: normalizedStatus,
    version: product.version,
  }
}

export const productService = {
  async getAllProducts(): Promise<ProductDto[]> {
    const response = await apiClient.get<unknown>('/api/products')
    const unwrapped = unwrapPayload(response.data)
    return toArrayPayload(unwrapped).map((item) => mapProduct(item))
  },

  async getProductById(id: number | string): Promise<ProductDto> {
    const response = await apiClient.get<unknown>(`/api/products/${id}`)
    return mapProduct(unwrapPayload(response.data))
  },

  async createProduct(product: ProductPayload): Promise<ProductDto> {
    const response = await apiClient.post<unknown>(
      '/api/products',
      toBackendPayload(product)
    )
    return mapProduct(unwrapPayload(response.data))
  },

  async updateProduct(
    id: number | string,
    product: ProductPayload
  ): Promise<ProductDto> {
    const response = await apiClient.put<unknown>(
      `/api/products/${id}`,
      toBackendPayload(product)
    )
    return mapProduct(unwrapPayload(response.data))
  },

  async deleteProduct(id: number | string): Promise<void> {
    await apiClient.delete(`/api/products/${id}`)
  },
}
