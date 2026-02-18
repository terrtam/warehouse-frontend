import type { Customer, Product, RecordStatus, Supplier } from '@/domain/wms/types'
import { apiClient } from '@/services/api/client'
import { mockWmsRepository } from './mock-repository'
import type {
  CustomerInput,
  CustomerListInput,
  CustomerRepository,
  ProductInput,
  ProductRepository,
  SupplierInput,
  SupplierRepository,
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

type CustomerDto = {
  id?: string
  name?: string
  email?: string
  phone?: string
  contactInfo?: string
  contact_info?: string
  status?: string
  version?: number
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
}

type SupplierDto = {
  id?: string
  name?: string
  email?: string
  phone?: string
  contactInfo?: string
  contact_info?: string
  address?: string
  status?: string
  version?: number
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
}

type ProductsListResponse = ProductDto[] | { content?: ProductDto[] }
type CustomersListResponse = CustomerDto[] | { content?: CustomerDto[] }
type SuppliersListResponse = SupplierDto[] | { content?: SupplierDto[] }

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

const splitContactInfo = (value: unknown) => {
  if (typeof value !== 'string') return { email: '', phone: '' }
  const [first, second] = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

  if (!first) return { email: '', phone: '' }
  if (first.includes('@')) {
    return {
      email: first,
      phone: second ?? '',
    }
  }

  return {
    email: second ?? '',
    phone: first,
  }
}

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

export const mapCustomerDto = (dto: CustomerDto): Customer => {
  const contactInfo = splitContactInfo(dto.contactInfo ?? dto.contact_info)
  return {
    id: dto.id ?? '',
    name: dto.name ?? '',
    email: dto.email ?? contactInfo.email,
    phone: dto.phone ?? contactInfo.phone,
    status: toStatus(dto.status),
    version: toNumber(dto.version),
    createdAt: toIsoOrNow(dto.createdAt ?? dto.created_at),
    updatedAt: toIsoOrNow(dto.updatedAt ?? dto.updated_at),
  }
}

export const mapSupplierDto = (dto: SupplierDto): Supplier => {
  const contactInfo = splitContactInfo(dto.contactInfo ?? dto.contact_info)
  return {
    id: dto.id ?? '',
    name: dto.name ?? '',
    email: dto.email ?? contactInfo.email,
    phone: dto.phone ?? contactInfo.phone,
    address: dto.address ?? '',
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

const toCustomerPayload = (input: CustomerInput, expectedVersion?: number) => ({
  name: input.name,
  email: input.email,
  phone: input.phone,
  status: input.status === 'inactive' ? 'INACTIVE' : 'ACTIVE',
  ...(expectedVersion === undefined ? {} : { version: expectedVersion }),
})

const toSupplierPayload = (input: SupplierInput, expectedVersion?: number) => ({
  name: input.name,
  email: input.email,
  phone: input.phone,
  address: input.address,
  status: input.status === 'inactive' ? 'INACTIVE' : 'ACTIVE',
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

export const httpCustomersRepository: CustomerRepository = {
  async list(input?: CustomerListInput) {
    const params: Record<string, unknown> = {}
    if (input?.updatedAfter) {
      params.updatedAfter = input.updatedAfter
    }
    if (input?.page !== undefined) {
      params.page = input.page
    }
    if (input?.size !== undefined) {
      params.size = input.size
    }

    const response = await apiClient.get<CustomersListResponse>('/api/customers', {
      params: Object.keys(params).length > 0 ? params : undefined,
    })
    const payload = response.data
    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.content)
        ? payload.content
        : []
    return rows.map((item) => mapCustomerDto(item))
  },

  async create(input) {
    const response = await apiClient.post<CustomerDto>(
      '/api/customers',
      toCustomerPayload(input)
    )
    return mapCustomerDto(response.data)
  },

  async update(id, input, _actor, expectedVersion) {
    const response = await apiClient.put<CustomerDto>(
      `/api/customers/${id}`,
      toCustomerPayload(input, expectedVersion),
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

    return mapCustomerDto(response.data)
  },
}

export const httpSuppliersRepository: SupplierRepository = {
  async list() {
    const response = await apiClient.get<SuppliersListResponse>('/api/suppliers')
    const payload = response.data
    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.content)
        ? payload.content
        : []
    return rows.map((item) => mapSupplierDto(item))
  },

  async create(input) {
    const response = await apiClient.post<SupplierDto>(
      '/api/suppliers',
      toSupplierPayload(input)
    )
    return mapSupplierDto(response.data)
  },

  async update(id, input, _actor, expectedVersion) {
    const response = await apiClient.put<SupplierDto>(
      `/api/suppliers/${id}`,
      toSupplierPayload(input, expectedVersion),
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

    return mapSupplierDto(response.data)
  },
}

export const httpWmsRepository: WmsRepository = {
  ...mockWmsRepository,
  products: httpProductsRepository,
  customers: httpCustomersRepository,
  suppliers: httpSuppliersRepository,
}
