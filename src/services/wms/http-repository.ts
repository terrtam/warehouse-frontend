import type {
  AuthClaims,
  Category,
  CommunicationLog,
  Customer,
  EntityAuditLog,
  InventoryRecord,
  InventoryTransaction,
  InventoryTxnType,
  LowStockTrendReportRow,
  Product,
  PurchaseCostTrackingReportRow,
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderStatus,
  Role,
  SalesByCategoryReportRow,
  SalesByProductReportRow,
  SalesOrder,
  SalesOrderLine,
  SalesOrderStatus,
  Supplier,
  SupplierPerformanceReportRow,
  VelocityReportRow,
  RecordStatus,
} from '@/domain/wms/types'
import { apiClient } from '@/services/api/client'
import type {
  AdjustmentInput,
  AuditLogListInput,
  AuditLogRepository,
  CategoryInput,
  CategoryRepository,
  CommunicationListInput,
  CommunicationRepository,
  CustomerInput,
  CustomerListInput,
  CustomerRepository,
  InventoryRepository,
  InventoryTransactionRepository,
  ProductInput,
  ProductRepository,
  PurchaseOrderRepository,
  ReportDateRangeInput,
  ReportsRepository,
  SalesOrderRepository,
  SupplierInput,
  SupplierRepository,
  WmsRepository,
  AuthRepository,
} from './repository'

type UnknownRecord = Record<string, unknown>

type PagedPayload<T> =
  | T[]
  | {
      content?: T[]
      items?: T[]
      results?: T[]
      rows?: T[]
    }

const nowIso = () => new Date().toISOString()

const toRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' ? (value as UnknownRecord) : {}

const pick = (record: UnknownRecord, keys: string[]): unknown => {
  for (const key of keys) {
    const value = record[key]
    if (value !== undefined && value !== null) {
      return value
    }
  }
  return undefined
}

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

const toStringValue = (value: unknown): string =>
  typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value)

const toStatus = (value: unknown): RecordStatus => {
  const normalized = toStringValue(value).trim().toLowerCase()
  return normalized === 'inactive' ? 'inactive' : 'active'
}

const toSalesStatus = (value: unknown): SalesOrderStatus => {
  const normalized = toStringValue(value).trim().toUpperCase()
  if (normalized === 'PARTIALLY_SHIPPED') return 'partially_shipped'
  if (normalized === 'SHIPPED') return 'shipped'
  if (normalized === 'CANCELLED') return 'cancelled'
  if (normalized === 'PROCESSING' || normalized === 'CONFIRMED') return 'processing'
  return 'draft'
}

const toPurchaseStatus = (value: unknown): PurchaseOrderStatus => {
  const normalized = toStringValue(value).trim().toUpperCase()
  if (normalized === 'ORDERED') return 'ordered'
  if (normalized === 'PARTIALLY_RECEIVED') return 'partially_received'
  if (normalized === 'RECEIVED') return 'received'
  if (normalized === 'CANCELLED') return 'cancelled'
  return 'draft'
}

const toInventoryTxnType = (value: unknown): InventoryTxnType => {
  const normalized = toStringValue(value).trim().toUpperCase()
  if (normalized === 'OUT') return 'OUT'
  if (normalized === 'ADJUST') return 'ADJUST'
  return 'IN'
}

const toIsoOrNow = (value: unknown): string => {
  const candidate = toStringValue(value).trim()
  if (!candidate) return nowIso()
  return Number.isFinite(Date.parse(candidate)) ? candidate : nowIso()
}

const toDateOnlyOrToday = (value: unknown): string => {
  const candidate = toStringValue(value).trim()
  if (!candidate) return nowIso().slice(0, 10)
  return candidate
}

const toIdString = (value: unknown): string => toStringValue(value).trim()

const toRows = <T>(payload: PagedPayload<T> | unknown): T[] => {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []

  const record = payload as UnknownRecord
  const candidateKeys = ['content', 'items', 'results', 'rows']
  for (const key of candidateKeys) {
    const candidate = record[key]
    if (Array.isArray(candidate)) {
      return candidate as T[]
    }
  }

  return []
}

const mapRole = (value: string): Role => {
  const normalized = value.trim().toLowerCase().replace(/^role_/, '').replace(/^role:/, '')
  if (
    normalized === 'manager' ||
    normalized === 'admin' ||
    normalized === 'administrator' ||
    normalized === 'superadmin'
  ) {
    return 'manager'
  }
  return 'staff'
}

const toRoleArray = (value: unknown): Role[] => {
  if (typeof value === 'string') {
    return value
      .split(/\s+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .map(mapRole)
  }

  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      if (typeof item === 'string') return item
      if (!item || typeof item !== 'object') return null
      const raw = item as UnknownRecord
      if (typeof raw.authority === 'string') return raw.authority
      if (typeof raw.role === 'string') return raw.role
      return null
    })
    .filter((item): item is string => item !== null)
    .map(mapRole)
}

const parseAuthClaims = (token: string, fallbackUsername: string): AuthClaims => {
  const defaultClaims: AuthClaims = {
    username: fallbackUsername,
    roles: ['staff'],
    exp: Date.now() + 1000 * 60 * 60 * 8,
  }

  try {
    const payloadSegment = token.split('.')[1] ?? ''
    if (!payloadSegment) return defaultClaims

    const normalized = payloadSegment.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const decoded = globalThis.atob(padded)
    const payload = JSON.parse(decoded) as UnknownRecord

    const username =
      toStringValue(payload.sub).trim() ||
      toStringValue(payload.username).trim() ||
      fallbackUsername

    const roles = [
      ...toRoleArray(payload.roles),
      ...toRoleArray(payload.role),
      ...toRoleArray(payload.authorities),
      ...toRoleArray(payload.scope),
      ...toRoleArray(payload.scp),
    ]

    const expRaw = toNumber(payload.exp)
    const exp = expRaw > 1_000_000_000_000 ? expRaw : expRaw * 1000

    return {
      username,
      roles: roles.length > 0 ? Array.from(new Set(roles)) : ['staff'],
      exp: exp > 0 ? exp : defaultClaims.exp,
    }
  } catch {
    return defaultClaims
  }
}

const requireVersion = (value: number | undefined): number => {
  if (value === undefined || Number.isNaN(value)) {
    throw new Error('Expected version is required for this operation')
  }
  return value
}

const toBackendStatus = (value: RecordStatus): string =>
  value === 'inactive' ? 'INACTIVE' : 'ACTIVE'

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

export const mapCategoryDto = (dto: UnknownRecord): Category => ({
  id: toIdString(pick(dto, ['id', 'categoryId', 'category_id'])),
  name: toStringValue(dto.name),
  description: toStringValue(dto.description),
  status: toStatus(dto.status),
  version: toNumber(dto.version),
  createdAt: toIsoOrNow(pick(dto, ['createdAt', 'created_at'])),
  updatedAt: toIsoOrNow(pick(dto, ['updatedAt', 'updated_at'])),
})

export const mapProductDto = (dto: UnknownRecord): Product => {
  const category = toRecord(dto.category)
  const categoryId = toIdString(
    pick(dto, ['categoryId', 'category_id']) ?? pick(category, ['id'])
  )
  const categoryName = toStringValue(
    pick(dto, ['categoryName', 'category_name']) ?? pick(category, ['name'])
  )

  return {
    id: toIdString(pick(dto, ['id', 'productId', 'product_id'])),
    name: toStringValue(dto.name),
    sku: toStringValue(dto.sku),
    categoryId,
    categoryName,
    description: toStringValue(dto.description),
    unit: toStringValue(dto.unit),
    defaultSalePrice: toNumber(pick(dto, ['defaultSalePrice', 'default_sale_price'])),
    costPrice: toNumber(pick(dto, ['costPrice', 'cost_price'])),
    reorderThreshold: toNumber(pick(dto, ['reorderThreshold', 'reorder_threshold'])),
    status: toStatus(dto.status),
    version: toNumber(dto.version),
    createdAt: toIsoOrNow(pick(dto, ['createdAt', 'created_at'])),
    updatedAt: toIsoOrNow(pick(dto, ['updatedAt', 'updated_at'])),
  }
}

export const mapCustomerDto = (dto: UnknownRecord): Customer => {
  const contactInfo = splitContactInfo(pick(dto, ['contactInfo', 'contact_info']))
  return {
    id: toIdString(pick(dto, ['id', 'customerId', 'customer_id'])),
    name: toStringValue(dto.name),
    email: toStringValue(dto.email) || contactInfo.email,
    phone: toStringValue(dto.phone) || contactInfo.phone,
    address: toStringValue(dto.address),
    status: toStatus(dto.status),
    notes: toStringValue(dto.notes),
    version: toNumber(dto.version),
    createdAt: toIsoOrNow(pick(dto, ['createdAt', 'created_at'])),
    updatedAt: toIsoOrNow(pick(dto, ['updatedAt', 'updated_at'])),
  }
}

export const mapSupplierDto = (dto: UnknownRecord): Supplier => {
  const contactInfo = splitContactInfo(pick(dto, ['contactInfo', 'contact_info']))
  return {
    id: toIdString(pick(dto, ['id', 'supplierId', 'supplier_id'])),
    name: toStringValue(dto.name),
    email: toStringValue(dto.email) || contactInfo.email,
    phone: toStringValue(dto.phone) || contactInfo.phone,
    address: toStringValue(dto.address),
    status: toStatus(dto.status),
    notes: toStringValue(dto.notes),
    version: toNumber(dto.version),
    createdAt: toIsoOrNow(pick(dto, ['createdAt', 'created_at'])),
    updatedAt: toIsoOrNow(pick(dto, ['updatedAt', 'updated_at'])),
  }
}

export const mapSalesOrderLineDto = (dto: UnknownRecord): SalesOrderLine => {
  const quantityOrdered = toNumber(pick(dto, ['quantityOrdered', 'quantity_ordered', 'quantity']))
  const quantityReserved = toNumber(pick(dto, ['quantityReserved', 'quantity_reserved']))
  const quantityShipped = toNumber(
    pick(dto, ['quantityShipped', 'quantity_shipped', 'shippedQuantity'])
  )
  const unitPrice = toNumber(pick(dto, ['unitPrice', 'unit_price']))

  return {
    id: toIdString(pick(dto, ['id', 'lineId', 'line_id'])),
    productId: toIdString(pick(dto, ['productId', 'product_id'])),
    productName: toStringValue(dto.productName),
    supplierId: toIdString(pick(dto, ['supplierId', 'supplier_id'])) || undefined,
    supplierName: toStringValue(pick(dto, ['supplierName', 'supplier_name'])) || undefined,
    quantityOrdered,
    quantityReserved,
    quantityShipped,
    unitPrice,
    lineTotal: toNumber(pick(dto, ['lineTotal', 'line_total'])) || unitPrice * quantityOrdered,
    quantity: quantityOrdered,
    shippedQuantity: quantityShipped,
  }
}

export const mapSalesOrderDto = (dto: UnknownRecord): SalesOrder => ({
  id: toIdString(dto.id),
  customerId: toIdString(pick(dto, ['customerId', 'customer_id'])),
  customerName: toStringValue(dto.customerName),
  date: toDateOnlyOrToday(dto.date),
  status: toSalesStatus(dto.status),
  lines: toRows<UnknownRecord>(dto.lines).map((line) => mapSalesOrderLineDto(toRecord(line))),
  version: toNumber(dto.version),
  createdAt: toIsoOrNow(pick(dto, ['createdAt', 'created_at'])),
  updatedAt: toIsoOrNow(pick(dto, ['updatedAt', 'updated_at'])),
})

export const mapPurchaseOrderLineDto = (dto: UnknownRecord): PurchaseOrderLine => {
  const quantityOrdered = toNumber(pick(dto, ['quantityOrdered', 'quantity_ordered', 'quantity']))
  const quantityReceived = toNumber(
    pick(dto, ['quantityReceived', 'quantity_received', 'receivedQuantity'])
  )
  const unitPrice = toNumber(pick(dto, ['unitPrice', 'unit_price']))

  return {
    id: toIdString(pick(dto, ['id', 'lineId', 'line_id'])),
    productId: toIdString(pick(dto, ['productId', 'product_id'])),
    productName: toStringValue(dto.productName),
    quantityOrdered,
    quantityReceived,
    unitPrice,
    lineTotal: toNumber(pick(dto, ['lineTotal', 'line_total'])) || unitPrice * quantityOrdered,
    quantity: quantityOrdered,
    receivedQuantity: quantityReceived,
  }
}

export const mapPurchaseOrderDto = (dto: UnknownRecord): PurchaseOrder => ({
  id: toIdString(dto.id),
  supplierId: toIdString(pick(dto, ['supplierId', 'supplier_id'])),
  supplierName: toStringValue(dto.supplierName),
  date: toDateOnlyOrToday(dto.date),
  status: toPurchaseStatus(dto.status),
  lines: toRows<UnknownRecord>(dto.lines).map((line) =>
    mapPurchaseOrderLineDto(toRecord(line))
  ),
  version: toNumber(dto.version),
  createdAt: toIsoOrNow(pick(dto, ['createdAt', 'created_at'])),
  updatedAt: toIsoOrNow(pick(dto, ['updatedAt', 'updated_at'])),
})

export const mapInventoryRecordDto = (dto: UnknownRecord): InventoryRecord => {
  const onHand = toNumber(pick(dto, ['onHand', 'on_hand', 'currentQuantity']))
  const reserved = toNumber(dto.reserved)
  const available =
    toNumber(dto.available) ||
    onHand - reserved

  return {
    productId: toIdString(pick(dto, ['productId', 'product_id'])),
    productName: toStringValue(dto.productName),
    sku: toStringValue(dto.sku),
    onHand,
    reserved,
    available,
    reorderThreshold: toNumber(pick(dto, ['reorderThreshold', 'reorder_threshold'])),
    lowStock: Boolean(dto.lowStock),
    currentQuantity: onHand,
  }
}

export const mapInventoryTransactionDto = (dto: UnknownRecord): InventoryTransaction => ({
  id: toIdString(dto.id),
  productId: toIdString(pick(dto, ['productId', 'product_id'])),
  productName: toStringValue(dto.productName),
  sku: toStringValue(dto.sku),
  quantity: toNumber(dto.quantity),
  type: toInventoryTxnType(dto.type),
  referenceType: toStringValue(pick(dto, ['referenceType', 'reference_type'])),
  referenceId: toIdString(pick(dto, ['referenceId', 'reference_id'])),
  referenceLineId: toIdString(pick(dto, ['referenceLineId', 'reference_line_id'])) || undefined,
  unitPrice: toNumber(pick(dto, ['unitPrice', 'unit_price'])) || undefined,
  reason: toStringValue(dto.reason) || undefined,
  performedBy: toIdString(pick(dto, ['performedBy', 'performed_by'])) || undefined,
  performedByUsername:
    toStringValue(pick(dto, ['performedByUsername', 'performed_by_username'])) ||
    toIdString(pick(dto, ['performedBy', 'performed_by'])),
  version: toNumber(dto.version),
  createdAt: toIsoOrNow(pick(dto, ['createdAt', 'created_at'])),
  updatedAt: toIsoOrNow(pick(dto, ['updatedAt', 'updated_at'])),
})

export const mapCommunicationLogDto = (dto: UnknownRecord): CommunicationLog => ({
  id: toIdString(dto.id),
  documentType: toStringValue(dto.documentType),
  documentId: toIdString(pick(dto, ['documentId', 'document_id'])),
  recipient: toStringValue(dto.recipient),
  channel: toStringValue(dto.channel),
  status: toStringValue(dto.status),
  senderUsername: toStringValue(dto.senderUsername),
  details: toStringValue(dto.details),
  createdAt: toIsoOrNow(pick(dto, ['createdAt', 'created_at'])),
})

export const mapEntityAuditLogDto = (dto: UnknownRecord): EntityAuditLog => ({
  id: toIdString(dto.id),
  entityType: toStringValue(dto.entityType),
  entityId: toIdString(pick(dto, ['entityId', 'entity_id'])),
  action: toStringValue(dto.action),
  oldValue: toStringValue(pick(dto, ['oldValue', 'old_value'])),
  newValue: toStringValue(pick(dto, ['newValue', 'new_value'])),
  performedBy: toIdString(pick(dto, ['performedBy', 'performed_by'])) || undefined,
  performedByUsername:
    toStringValue(pick(dto, ['performedByUsername', 'performed_by_username'])) ||
    toIdString(pick(dto, ['performedBy', 'performed_by'])),
  createdAt: toIsoOrNow(pick(dto, ['createdAt', 'created_at'])),
})

const toCategoryPayload = (input: CategoryInput, expectedVersion?: number) => ({
  name: input.name,
  description: input.description,
  status: toBackendStatus(input.status),
  ...(expectedVersion === undefined ? {} : { version: expectedVersion }),
})

const toProductPayload = (input: ProductInput, expectedVersion?: number) => ({
  name: input.name,
  sku: input.sku,
  categoryId: input.categoryId || null,
  categoryName: input.categoryName,
  description: input.description,
  unit: input.unit,
  defaultSalePrice: input.defaultSalePrice,
  costPrice: input.costPrice,
  reorderThreshold: input.reorderThreshold,
  status: toBackendStatus(input.status),
  ...(expectedVersion === undefined ? {} : { version: expectedVersion }),
})

const toCustomerPayload = (input: CustomerInput, expectedVersion?: number) => ({
  name: input.name,
  email: input.email,
  phone: input.phone,
  address: input.address,
  status: toBackendStatus(input.status),
  notes: input.notes,
  ...(expectedVersion === undefined ? {} : { version: expectedVersion }),
})

const toSupplierPayload = (input: SupplierInput, expectedVersion?: number) => ({
  name: input.name,
  email: input.email,
  phone: input.phone,
  address: input.address,
  status: toBackendStatus(input.status),
  notes: input.notes,
  ...(expectedVersion === undefined ? {} : { version: expectedVersion }),
})

const toRangeParams = (input?: ReportDateRangeInput) => {
  if (!input?.from && !input?.to) return undefined
  return {
    ...(input.from ? { from: input.from } : {}),
    ...(input.to ? { to: input.to } : {}),
  }
}

export const httpAuthRepository: AuthRepository = {
  async login(input) {
    const response = await apiClient.post<{ token?: string }>('/auth/login', input)
    const token = toStringValue(response.data?.token)
    return {
      token,
      claims: parseAuthClaims(token, input.username),
    }
  },
}

export const httpCategoriesRepository: CategoryRepository = {
  async list() {
    const response = await apiClient.get<PagedPayload<UnknownRecord>>('/api/categories')
    return toRows(response.data).map((item) => mapCategoryDto(toRecord(item)))
  },

  async create(input) {
    const response = await apiClient.post<UnknownRecord>('/api/categories', toCategoryPayload(input))
    return mapCategoryDto(toRecord(response.data))
  },

  async update(id, input, _actor, expectedVersion) {
    const response = await apiClient.put<UnknownRecord>(
      `/api/categories/${id}`,
      toCategoryPayload(input, expectedVersion)
    )
    return mapCategoryDto(toRecord(response.data))
  },
}

export const httpProductsRepository: ProductRepository = {
  async list() {
    const response = await apiClient.get<PagedPayload<UnknownRecord>>('/api/products')
    return toRows(response.data).map((item) => mapProductDto(toRecord(item)))
  },

  async create(input) {
    const response = await apiClient.post<UnknownRecord>('/api/products', toProductPayload(input))
    return mapProductDto(toRecord(response.data))
  },

  async update(id, input, _actor, expectedVersion) {
    const response = await apiClient.put<UnknownRecord>(
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

    return mapProductDto(toRecord(response.data))
  },

  async delete(id, _actor, expectedVersion) {
    await apiClient.delete(
      `/api/products/${id}`,
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

    const response = await apiClient.get<PagedPayload<UnknownRecord>>('/api/customers', {
      params: Object.keys(params).length > 0 ? params : undefined,
    })

    return toRows(response.data).map((item) => mapCustomerDto(toRecord(item)))
  },

  async create(input) {
    const response = await apiClient.post<UnknownRecord>('/api/customers', toCustomerPayload(input))
    return mapCustomerDto(toRecord(response.data))
  },

  async update(id, input, _actor, expectedVersion) {
    const response = await apiClient.put<UnknownRecord>(
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

    return mapCustomerDto(toRecord(response.data))
  },
}

export const httpSuppliersRepository: SupplierRepository = {
  async list() {
    const response = await apiClient.get<PagedPayload<UnknownRecord>>('/api/suppliers')
    return toRows(response.data).map((item) => mapSupplierDto(toRecord(item)))
  },

  async create(input) {
    const response = await apiClient.post<UnknownRecord>('/api/suppliers', toSupplierPayload(input))
    return mapSupplierDto(toRecord(response.data))
  },

  async update(id, input, _actor, expectedVersion) {
    const response = await apiClient.put<UnknownRecord>(
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

    return mapSupplierDto(toRecord(response.data))
  },
}

export const httpSalesOrdersRepository: SalesOrderRepository = {
  async list() {
    const response = await apiClient.get<PagedPayload<UnknownRecord>>('/api/sales-orders')
    return toRows(response.data).map((item) => mapSalesOrderDto(toRecord(item)))
  },

  async create(input) {
    const response = await apiClient.post<UnknownRecord>('/api/sales-orders', {
      customerId: input.customerId,
      lines: input.lines.map((line) => ({
        productId: line.productId,
        ...(line.supplierId === undefined ? {} : { supplierId: line.supplierId }),
        quantity: line.quantity,
        ...(line.unitPrice === undefined ? {} : { unitPrice: line.unitPrice }),
      })),
    })

    return mapSalesOrderDto(toRecord(response.data))
  },

  async confirm(id, _actor, expectedVersion) {
    const response = await apiClient.post<UnknownRecord>(
      `/api/sales-orders/${id}/confirm`,
      {
        version: requireVersion(expectedVersion),
      }
    )

    return mapSalesOrderDto(toRecord(response.data))
  },

  async ship(id, lines, _actor, expectedVersion) {
    const response = await apiClient.post<UnknownRecord>(`/api/sales-orders/${id}/ship`, {
      version: requireVersion(expectedVersion),
      lines: lines.map((line) => ({
        lineId: line.lineId,
        quantity: line.quantity,
      })),
    })

    return mapSalesOrderDto(toRecord(response.data))
  },

  async cancel(id, _actor, expectedVersion) {
    const response = await apiClient.post<UnknownRecord>(`/api/sales-orders/${id}/cancel`, {
      version: requireVersion(expectedVersion),
    })

    return mapSalesOrderDto(toRecord(response.data))
  },
}

export const httpPurchaseOrdersRepository: PurchaseOrderRepository = {
  async list() {
    const response = await apiClient.get<PagedPayload<UnknownRecord>>('/api/purchase-orders')
    return toRows(response.data).map((item) => mapPurchaseOrderDto(toRecord(item)))
  },

  async create(input) {
    const response = await apiClient.post<UnknownRecord>('/api/purchase-orders', {
      supplierId: input.supplierId,
      lines: input.lines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        ...(line.unitPrice === undefined ? {} : { unitPrice: line.unitPrice }),
      })),
    })

    return mapPurchaseOrderDto(toRecord(response.data))
  },

  async order(id, _actor, expectedVersion) {
    const response = await apiClient.post<UnknownRecord>(
      `/api/purchase-orders/${id}/order`,
      {
        version: requireVersion(expectedVersion),
      }
    )

    return mapPurchaseOrderDto(toRecord(response.data))
  },

  async receive(id, lines, _actor, expectedVersion) {
    const response = await apiClient.post<UnknownRecord>(
      `/api/purchase-orders/${id}/receive`,
      {
        version: requireVersion(expectedVersion),
        lines: lines.map((line) => ({
          lineId: line.lineId,
          quantity: line.quantity,
        })),
      }
    )

    return mapPurchaseOrderDto(toRecord(response.data))
  },

  async cancel(id, _actor, expectedVersion) {
    const response = await apiClient.post<UnknownRecord>(
      `/api/purchase-orders/${id}/cancel`,
      {
        version: requireVersion(expectedVersion),
      }
    )

    return mapPurchaseOrderDto(toRecord(response.data))
  },
}

export const httpInventoryRepository: InventoryRepository = {
  async list() {
    const response = await apiClient.get<PagedPayload<UnknownRecord>>('/api/inventory')
    return toRows(response.data).map((item) => mapInventoryRecordDto(toRecord(item)))
  },

  async adjust(input: AdjustmentInput) {
    const response = await apiClient.post<UnknownRecord>('/api/inventory/adjustments', {
      productId: input.productId,
      quantityDelta: input.quantityDelta,
      reason: input.reason,
      allowNegativeOverride: Boolean(input.allowNegativeOverride),
      ...(input.unitPrice === undefined ? {} : { unitPrice: input.unitPrice }),
    })

    return mapInventoryRecordDto(toRecord(response.data))
  },
}

export const httpInventoryTransactionsRepository: InventoryTransactionRepository = {
  async list() {
    const response = await apiClient.get<PagedPayload<UnknownRecord>>(
      '/api/inventory/transactions'
    )
    return toRows(response.data).map((item) =>
      mapInventoryTransactionDto(toRecord(item))
    )
  },
}

export const httpCommunicationsRepository: CommunicationRepository = {
  async list(input?: CommunicationListInput) {
    const params: Record<string, unknown> = {}
    if (input?.documentType) params.documentType = input.documentType
    if (input?.channel) params.channel = input.channel
    if (input?.status) params.status = input.status

    const response = await apiClient.get<PagedPayload<UnknownRecord>>('/api/communications', {
      params: Object.keys(params).length > 0 ? params : undefined,
    })

    return toRows(response.data).map((item) =>
      mapCommunicationLogDto(toRecord(item))
    )
  },
}

export const httpAuditLogRepository: AuditLogRepository = {
  async list(input?: AuditLogListInput) {
    const params: Record<string, unknown> = {}
    if (input?.entityType) params.entityType = input.entityType

    const response = await apiClient.get<PagedPayload<UnknownRecord>>('/api/audit-log', {
      params: Object.keys(params).length > 0 ? params : undefined,
    })

    return toRows(response.data).map((item) => mapEntityAuditLogDto(toRecord(item)))
  },
}

const mapSalesByProductReportRow = (dto: UnknownRecord): SalesByProductReportRow => ({
  productId: toIdString(dto.productId),
  productName: toStringValue(dto.productName),
  sku: toStringValue(dto.sku),
  shippedQuantity: toNumber(dto.shippedQuantity),
  revenue: toNumber(dto.revenue),
})

const mapSalesByCategoryReportRow = (dto: UnknownRecord): SalesByCategoryReportRow => ({
  categoryName: toStringValue(dto.categoryName),
  shippedQuantity: toNumber(dto.shippedQuantity),
  revenue: toNumber(dto.revenue),
})

const mapPurchaseCostTrackingReportRow = (
  dto: UnknownRecord
): PurchaseCostTrackingReportRow => ({
  purchaseOrderId: toIdString(dto.purchaseOrderId),
  supplierId: toIdString(dto.supplierId),
  supplierName: toStringValue(dto.supplierName),
  receivedCost: toNumber(dto.receivedCost),
  orderDate: toDateOnlyOrToday(dto.orderDate),
})

const mapSupplierPerformanceReportRow = (
  dto: UnknownRecord
): SupplierPerformanceReportRow => ({
  supplierId: toIdString(dto.supplierId),
  supplierName: toStringValue(dto.supplierName),
  totalOrders: toNumber(dto.totalOrders),
  receivedOrders: toNumber(dto.receivedOrders),
  receiveRate: toNumber(dto.receiveRate),
  avgLeadDays: toNumber(dto.avgLeadDays),
})

const mapVelocityReportRow = (dto: UnknownRecord): VelocityReportRow => ({
  productId: toIdString(dto.productId),
  productName: toStringValue(dto.productName),
  sku: toStringValue(dto.sku),
  inbound: toNumber(dto.inbound),
  outbound: toNumber(dto.outbound),
  net: toNumber(dto.net),
})

const mapLowStockTrendReportRow = (dto: UnknownRecord): LowStockTrendReportRow => ({
  productId: toIdString(dto.productId),
  productName: toStringValue(dto.productName),
  sku: toStringValue(dto.sku),
  onHand: toNumber(dto.onHand),
  reserved: toNumber(dto.reserved),
  available: toNumber(dto.available),
  reorderThreshold: toNumber(dto.reorderThreshold),
  lowStock: Boolean(dto.lowStock),
  lastMovementAt: toStringValue(dto.lastMovementAt) || undefined,
})

export const httpReportsRepository: ReportsRepository = {
  async salesByProduct(input?: ReportDateRangeInput) {
    const response = await apiClient.get<PagedPayload<UnknownRecord>>(
      '/api/reports/sales-by-product',
      {
        params: toRangeParams(input),
      }
    )
    return toRows(response.data).map((item) =>
      mapSalesByProductReportRow(toRecord(item))
    )
  },

  async salesByCategory(input?: ReportDateRangeInput) {
    const response = await apiClient.get<PagedPayload<UnknownRecord>>(
      '/api/reports/sales-by-category',
      {
        params: toRangeParams(input),
      }
    )
    return toRows(response.data).map((item) =>
      mapSalesByCategoryReportRow(toRecord(item))
    )
  },

  async purchaseCostTracking(input?: ReportDateRangeInput) {
    const response = await apiClient.get<PagedPayload<UnknownRecord>>(
      '/api/reports/purchase-cost-tracking',
      {
        params: toRangeParams(input),
      }
    )
    return toRows(response.data).map((item) =>
      mapPurchaseCostTrackingReportRow(toRecord(item))
    )
  },

  async supplierPerformance(input?: ReportDateRangeInput) {
    const response = await apiClient.get<PagedPayload<UnknownRecord>>(
      '/api/reports/supplier-performance',
      {
        params: toRangeParams(input),
      }
    )
    return toRows(response.data).map((item) =>
      mapSupplierPerformanceReportRow(toRecord(item))
    )
  },

  async velocity(input?: ReportDateRangeInput) {
    const response = await apiClient.get<PagedPayload<UnknownRecord>>(
      '/api/reports/velocity',
      {
        params: toRangeParams(input),
      }
    )
    return toRows(response.data).map((item) => mapVelocityReportRow(toRecord(item)))
  },

  async lowStockTrends() {
    const response = await apiClient.get<PagedPayload<UnknownRecord>>(
      '/api/reports/low-stock-trends'
    )
    return toRows(response.data).map((item) =>
      mapLowStockTrendReportRow(toRecord(item))
    )
  },
}

export const httpWmsRepository: WmsRepository = {
  auth: httpAuthRepository,
  categories: httpCategoriesRepository,
  products: httpProductsRepository,
  customers: httpCustomersRepository,
  suppliers: httpSuppliersRepository,
  salesOrders: httpSalesOrdersRepository,
  purchaseOrders: httpPurchaseOrdersRepository,
  inventory: httpInventoryRepository,
  inventoryTransactions: httpInventoryTransactionsRepository,
  communications: httpCommunicationsRepository,
  auditLog: httpAuditLogRepository,
  reports: httpReportsRepository,
}
