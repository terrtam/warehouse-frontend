import type {
  AuthClaims,
  Category,
  CommunicationLog,
  Customer,
  EntityAuditLog,
  InventoryRecord,
  InventoryTransaction,
  Product,
  PurchaseOrder,
  PurchaseOrderLine,
  Role,
  SalesOrder,
  SalesOrderLine,
  Supplier,
} from '@/domain/wms/types'
import { mockRealtimeTransport } from '@/services/realtime/mock-transport'
import { realtimeTopics } from '@/services/realtime/transport'
import { WmsError } from './errors'
import type {
  Actor,
  AdjustmentInput,
  CreatePurchaseOrderInput,
  CreateSalesOrderInput,
  CustomerListInput,
  ReceiveLineInput,
  ReportDateRangeInput,
  ShipLineInput,
  WmsRepository,
} from './repository'

type DbState = {
  categories: Category[]
  products: Product[]
  customers: Customer[]
  suppliers: Supplier[]
  salesOrders: SalesOrder[]
  purchaseOrders: PurchaseOrder[]
  inventoryTransactions: InventoryTransaction[]
  communications: CommunicationLog[]
  auditLog: EntityAuditLog[]
}

const nowIso = () => new Date().toISOString()

const toBase64Url = (value: string) =>
  btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const createMockJwt = (claims: AuthClaims) => {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = toBase64Url(
    JSON.stringify({
      sub: claims.username,
      roles: claims.roles,
      exp: Math.floor(claims.exp / 1000),
    })
  )
  return `${header}.${payload}.${toBase64Url('mock-signature')}`
}

const nextId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now()
    .toString(36)
    .slice(-4)}`

const deepClone = <T>(value: T): T => structuredClone(value)

const touch = <T extends { version: number; updatedAt: string }>(value: T) => {
  value.version += 1
  value.updatedAt = nowIso()
}

const findById = <T extends { id: string }>(rows: T[], id: string, label: string) => {
  const found = rows.find((row) => row.id === id)
  if (!found) throw new WmsError('NOT_FOUND', `${label} not found`)
  return found
}

const assertManager = (actor: Actor, action: string) => {
  if (actor.role !== 'manager') {
    throw new WmsError('FORBIDDEN', `${action} is manager only`)
  }
}

const assertVersion = (expected: number | undefined, current: number) => {
  if (expected === undefined) return
  if (expected !== current) {
    throw new WmsError('CONFLICT', 'Record has been changed by another user')
  }
}

const publish = (topic: keyof typeof realtimeTopics, eventType: string, entityId: string) => {
  mockRealtimeTransport.publish(realtimeTopics[topic], {
    eventType,
    entityId,
    occurredAt: nowIso(),
  })
}

const state: DbState = (() => {
  const createdAt = nowIso()
  return {
    categories: [
      {
        id: 'cat-electronics',
        name: 'Electronics',
        description: 'Devices and accessories',
        status: 'active',
        version: 1,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    products: [
      {
        id: 'prd-scanner',
        name: 'Wireless Scanner',
        sku: 'WH-1001',
        categoryId: 'cat-electronics',
        categoryName: 'Electronics',
        description: 'Warehouse scanner',
        unit: 'pcs',
        defaultSalePrice: 129.99,
        costPrice: 80,
        reorderThreshold: 20,
        status: 'active',
        version: 1,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    customers: [
      {
        id: 'cus-acme',
        name: 'ACME Retail',
        email: 'buyer@acme.example',
        phone: '+1 555 1000',
        address: '100 Main St',
        status: 'active',
        notes: '',
        version: 1,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    suppliers: [
      {
        id: 'sup-apex',
        name: 'Apex Supply Co.',
        email: 'sales@apex.example',
        phone: '+1 555 3000',
        address: '9 Industrial Rd',
        status: 'active',
        notes: '',
        version: 1,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    salesOrders: [],
    purchaseOrders: [],
    inventoryTransactions: [
      {
        id: nextId('txn'),
        productId: 'prd-scanner',
        productName: 'Wireless Scanner',
        sku: 'WH-1001',
        quantity: 60,
        type: 'IN',
        referenceType: 'PO',
        referenceId: 'seed-po',
        performedBy: 'seed',
        performedByUsername: 'seed',
        version: 1,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    communications: [],
    auditLog: [],
  }
})()

const onHandByProduct = () => {
  const map = new Map<string, number>()
  state.inventoryTransactions.forEach((txn) => {
    const current = map.get(txn.productId) ?? 0
    const delta = txn.type === 'OUT' ? -txn.quantity : txn.quantity
    map.set(txn.productId, current + delta)
  })
  return map
}

const reservedByProduct = () => {
  const map = new Map<string, number>()
  state.salesOrders
    .filter((order) => order.status === 'processing' || order.status === 'partially_shipped')
    .forEach((order) => {
      order.lines.forEach((line) => {
        map.set(line.productId, (map.get(line.productId) ?? 0) + line.quantityReserved)
      })
    })
  return map
}

const buildInventory = (): InventoryRecord[] => {
  const onHand = onHandByProduct()
  const reserved = reservedByProduct()
  return state.products.map((product) => {
    const onHandQty = onHand.get(product.id) ?? 0
    const reservedQty = reserved.get(product.id) ?? 0
    const available = onHandQty - reservedQty
    return {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      onHand: onHandQty,
      reserved: reservedQty,
      available,
      reorderThreshold: product.reorderThreshold,
      lowStock: available <= product.reorderThreshold,
      currentQuantity: onHandQty,
    }
  })
}

const addTxn = (
  payload: Omit<InventoryTransaction, 'id' | 'version' | 'createdAt' | 'updatedAt'>
) => {
  const timestamp = nowIso()
  state.inventoryTransactions.unshift({
    ...payload,
    id: nextId('txn'),
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
}

const addCommunication = (
  documentType: string,
  documentId: string,
  recipient: string,
  details: string,
  senderUsername: string
) => {
  state.communications.unshift({
    id: nextId('comm'),
    documentType,
    documentId,
    recipient,
    channel: 'EMAIL',
    status: 'SENT',
    senderUsername,
    details,
    createdAt: nowIso(),
  })
  publish('communications', 'COMMUNICATION_LOGGED', documentId)
}

const authUsers: Record<string, { password: string; role: Role }> = {
  manager: { password: 'password123', role: 'manager' },
  staff: { password: 'password123', role: 'staff' },
}

export const mockWmsRepository: WmsRepository = {
  auth: {
    async login(input) {
      const user = authUsers[input.username.toLowerCase()]
      if (!user || user.password !== input.password) {
        throw new WmsError('VALIDATION', 'Invalid username or password')
      }
      const claims: AuthClaims = {
        username: input.username,
        roles: [user.role],
        exp: Date.now() + 1000 * 60 * 60 * 8,
      }
      return { token: createMockJwt(claims), claims }
    },
  },
  categories: {
    async list() {
      return deepClone(state.categories)
    },
    async create(input, actor) {
      assertManager(actor, 'Creating categories')
      const timestamp = nowIso()
      const category: Category = {
        id: nextId('cat'),
        name: input.name.trim(),
        description: input.description.trim(),
        status: input.status,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      state.categories.unshift(category)
      publish('categories', 'CATEGORY_CREATED', category.id)
      return deepClone(category)
    },
    async update(id, input, actor, expectedVersion) {
      assertManager(actor, 'Updating categories')
      const category = findById(state.categories, id, 'Category')
      assertVersion(expectedVersion, category.version)
      category.name = input.name.trim()
      category.description = input.description.trim()
      category.status = input.status
      touch(category)
      publish('categories', 'CATEGORY_UPDATED', category.id)
      return deepClone(category)
    },
  },
  products: {
    async list() {
      return deepClone(state.products)
    },
    async create(input, actor) {
      assertManager(actor, 'Creating products')
      const timestamp = nowIso()
      const category = findById(state.categories, input.categoryId, 'Category')
      const product: Product = {
        id: nextId('prd'),
        name: input.name.trim(),
        sku: input.sku.trim(),
        categoryId: category.id,
        categoryName: category.name,
        description: input.description?.trim() ?? '',
        unit: input.unit.trim(),
        defaultSalePrice: input.defaultSalePrice,
        costPrice: input.costPrice,
        reorderThreshold: input.reorderThreshold,
        status: input.status,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      state.products.unshift(product)
      publish('products', 'PRODUCT_CREATED', product.id)
      return deepClone(product)
    },
    async update(id, input, actor, expectedVersion) {
      assertManager(actor, 'Updating products')
      const product = findById(state.products, id, 'Product')
      assertVersion(expectedVersion, product.version)
      const category = findById(state.categories, input.categoryId, 'Category')
      product.name = input.name.trim()
      product.sku = input.sku.trim()
      product.categoryId = category.id
      product.categoryName = category.name
      product.description = input.description?.trim() ?? ''
      product.unit = input.unit.trim()
      product.defaultSalePrice = input.defaultSalePrice
      product.costPrice = input.costPrice
      product.reorderThreshold = input.reorderThreshold
      product.status = input.status
      touch(product)
      publish('products', 'PRODUCT_UPDATED', product.id)
      return deepClone(product)
    },
    async delete(id, actor, expectedVersion) {
      assertManager(actor, 'Deleting products')
      const product = findById(state.products, id, 'Product')
      assertVersion(expectedVersion, product.version)
      state.products = state.products.filter((row) => row.id !== id)
      publish('products', 'PRODUCT_DELETED', id)
    },
  },
  customers: {
    async list(input?: CustomerListInput) {
      if (!input?.updatedAfter) return deepClone(state.customers)
      const checkpoint = Date.parse(input.updatedAfter)
      if (!Number.isFinite(checkpoint)) return deepClone(state.customers)
      return deepClone(
        state.customers.filter((row) => Date.parse(row.updatedAt) > checkpoint)
      )
    },
    async create(input, actor) {
      assertManager(actor, 'Creating customers')
      const timestamp = nowIso()
      const customer: Customer = {
        id: nextId('cus'),
        name: input.name.trim(),
        email: input.email.trim(),
        phone: input.phone.trim(),
        address: input.address.trim(),
        status: input.status,
        notes: input.notes.trim(),
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      state.customers.unshift(customer)
      publish('customers', 'CUSTOMER_CREATED', customer.id)
      return deepClone(customer)
    },
    async update(id, input, actor, expectedVersion) {
      assertManager(actor, 'Updating customers')
      const customer = findById(state.customers, id, 'Customer')
      assertVersion(expectedVersion, customer.version)
      customer.name = input.name.trim()
      customer.email = input.email.trim()
      customer.phone = input.phone.trim()
      customer.address = input.address.trim()
      customer.status = input.status
      customer.notes = input.notes.trim()
      touch(customer)
      publish('customers', 'CUSTOMER_UPDATED', customer.id)
      return deepClone(customer)
    },
  },
  suppliers: {
    async list() {
      return deepClone(state.suppliers)
    },
    async create(input, actor) {
      assertManager(actor, 'Creating suppliers')
      const timestamp = nowIso()
      const supplier: Supplier = {
        id: nextId('sup'),
        name: input.name.trim(),
        email: input.email.trim(),
        phone: input.phone.trim(),
        address: input.address.trim(),
        status: input.status,
        notes: input.notes.trim(),
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      state.suppliers.unshift(supplier)
      publish('suppliers', 'SUPPLIER_CREATED', supplier.id)
      return deepClone(supplier)
    },
    async update(id, input, actor, expectedVersion) {
      assertManager(actor, 'Updating suppliers')
      const supplier = findById(state.suppliers, id, 'Supplier')
      assertVersion(expectedVersion, supplier.version)
      supplier.name = input.name.trim()
      supplier.email = input.email.trim()
      supplier.phone = input.phone.trim()
      supplier.address = input.address.trim()
      supplier.status = input.status
      supplier.notes = input.notes.trim()
      touch(supplier)
      publish('suppliers', 'SUPPLIER_UPDATED', supplier.id)
      return deepClone(supplier)
    },
  },
  salesOrders: {
    async list() {
      return deepClone(state.salesOrders)
    },
    async create(input: CreateSalesOrderInput, actor: Actor) {
      assertManager(actor, 'Creating sales orders')
      const customer = findById(state.customers, input.customerId, 'Customer')
      const timestamp = nowIso()
      const lines: SalesOrderLine[] = input.lines.map((line) => {
        const product = findById(state.products, line.productId, 'Product')
        const unitPrice = line.unitPrice ?? product.defaultSalePrice
        return {
          id: nextId('sol'),
          productId: product.id,
          productName: product.name,
          quantityOrdered: line.quantity,
          quantityReserved: 0,
          quantityShipped: 0,
          unitPrice,
          lineTotal: unitPrice * line.quantity,
          quantity: line.quantity,
          shippedQuantity: 0,
        }
      })
      const order: SalesOrder = {
        id: nextId('so'),
        customerId: customer.id,
        customerName: customer.name,
        date: timestamp.slice(0, 10),
        status: 'draft',
        lines,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      state.salesOrders.unshift(order)
      publish('orders', 'SALES_ORDER_CREATED', order.id)
      return deepClone(order)
    },
    async confirm(id, _actor, expectedVersion) {
      const order = findById(state.salesOrders, id, 'Sales order')
      assertVersion(expectedVersion, order.version)
      const inventory = buildInventory()
      order.lines.forEach((line) => {
        const available = inventory.find((row) => row.productId === line.productId)?.available ?? 0
        line.quantityReserved = Math.min(available, line.quantityOrdered - line.quantityShipped)
      })
      order.status = 'processing'
      touch(order)
      const recipient = findById(state.customers, order.customerId, 'Customer').email
      addCommunication('SALES_ORDER', order.id, recipient, 'Sales order confirmed', 'mock')
      publish('orders', 'SALES_ORDER_CONFIRMED', order.id)
      return deepClone(order)
    },
    async ship(id, lines: ShipLineInput[], actor: Actor, expectedVersion) {
      const order = findById(state.salesOrders, id, 'Sales order')
      assertVersion(expectedVersion, order.version)
      lines.forEach((shipment) => {
        const line = findById(order.lines, shipment.lineId, 'Sales order line')
        line.quantityReserved = Math.max(0, line.quantityReserved - shipment.quantity)
        line.quantityShipped += shipment.quantity
        line.shippedQuantity = line.quantityShipped
        const product = findById(state.products, line.productId, 'Product')
        addTxn({
          productId: line.productId,
          productName: line.productName,
          sku: product.sku,
          quantity: shipment.quantity,
          type: 'OUT',
          referenceType: 'SO',
          referenceId: order.id,
          referenceLineId: line.id,
          unitPrice: line.unitPrice,
          performedBy: actor.username,
          performedByUsername: actor.username,
        })
      })
      order.status = order.lines.every((line) => line.quantityShipped >= line.quantityOrdered)
        ? 'shipped'
        : 'partially_shipped'
      touch(order)
      publish('orders', 'SALES_ORDER_SHIPPED', order.id)
      publish('inventory', 'INVENTORY_SHIPPED', order.id)
      return deepClone(order)
    },
    async cancel(id, _actor, expectedVersion) {
      const order = findById(state.salesOrders, id, 'Sales order')
      assertVersion(expectedVersion, order.version)
      order.status = 'cancelled'
      order.lines.forEach((line) => {
        line.quantityReserved = 0
      })
      touch(order)
      publish('orders', 'SALES_ORDER_CANCELLED', order.id)
      return deepClone(order)
    },
  },
  purchaseOrders: {
    async list() {
      return deepClone(state.purchaseOrders)
    },
    async create(input: CreatePurchaseOrderInput, actor: Actor) {
      assertManager(actor, 'Creating purchase orders')
      const supplier = findById(state.suppliers, input.supplierId, 'Supplier')
      const timestamp = nowIso()
      const lines: PurchaseOrderLine[] = input.lines.map((line) => {
        const product = findById(state.products, line.productId, 'Product')
        const unitPrice = line.unitPrice ?? product.costPrice
        return {
          id: nextId('pol'),
          productId: product.id,
          productName: product.name,
          quantityOrdered: line.quantity,
          quantityReceived: 0,
          unitPrice,
          lineTotal: unitPrice * line.quantity,
          quantity: line.quantity,
          receivedQuantity: 0,
        }
      })
      const order: PurchaseOrder = {
        id: nextId('po'),
        supplierId: supplier.id,
        supplierName: supplier.name,
        date: timestamp.slice(0, 10),
        status: 'draft',
        lines,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      state.purchaseOrders.unshift(order)
      publish('orders', 'PURCHASE_ORDER_CREATED', order.id)
      return deepClone(order)
    },
    async order(id, actor: Actor, expectedVersion) {
      const order = findById(state.purchaseOrders, id, 'Purchase order')
      assertVersion(expectedVersion, order.version)
      order.status = 'ordered'
      touch(order)
      const recipient = findById(state.suppliers, order.supplierId, 'Supplier').email
      addCommunication('PURCHASE_ORDER', order.id, recipient, 'Purchase order sent', actor.username)
      publish('orders', 'PURCHASE_ORDER_ORDERED', order.id)
      return deepClone(order)
    },
    async receive(id, lines: ReceiveLineInput[], actor: Actor, expectedVersion) {
      const order = findById(state.purchaseOrders, id, 'Purchase order')
      assertVersion(expectedVersion, order.version)
      lines.forEach((receipt) => {
        const line = findById(order.lines, receipt.lineId, 'Purchase order line')
        line.quantityReceived += receipt.quantity
        line.receivedQuantity = line.quantityReceived
        const product = findById(state.products, line.productId, 'Product')
        addTxn({
          productId: line.productId,
          productName: line.productName,
          sku: product.sku,
          quantity: receipt.quantity,
          type: 'IN',
          referenceType: 'PO',
          referenceId: order.id,
          referenceLineId: line.id,
          unitPrice: line.unitPrice,
          performedBy: actor.username,
          performedByUsername: actor.username,
        })
      })
      order.status = order.lines.every((line) => line.quantityReceived >= line.quantityOrdered)
        ? 'received'
        : 'partially_received'
      touch(order)
      publish('orders', 'PURCHASE_ORDER_RECEIVED', order.id)
      publish('inventory', 'INVENTORY_RECEIVED', order.id)
      return deepClone(order)
    },
    async cancel(id, _actor, expectedVersion) {
      const order = findById(state.purchaseOrders, id, 'Purchase order')
      assertVersion(expectedVersion, order.version)
      order.status = 'cancelled'
      touch(order)
      publish('orders', 'PURCHASE_ORDER_CANCELLED', order.id)
      return deepClone(order)
    },
  },
  inventory: {
    async list() {
      return deepClone(buildInventory())
    },
    async adjust(input: AdjustmentInput, actor: Actor) {
      const product = findById(state.products, input.productId, 'Product')
      addTxn({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantity: input.quantityDelta,
        type: 'ADJUST',
        referenceType: 'ADJUSTMENT',
        referenceId: nextId('adj'),
        unitPrice: input.unitPrice,
        reason: input.reason,
        performedBy: actor.username,
        performedByUsername: actor.username,
      })
      publish('inventory', 'INVENTORY_ADJUSTED', product.id)
      return deepClone(buildInventory().find((row) => row.productId === product.id)!)
    },
  },
  inventoryTransactions: {
    async list() {
      return deepClone(state.inventoryTransactions)
    },
  },
  communications: {
    async list() {
      return deepClone(state.communications)
    },
  },
  auditLog: {
    async list() {
      return deepClone(state.auditLog)
    },
  },
  reports: {
    async salesByProduct(_input?: ReportDateRangeInput) {
      return []
    },
    async salesByCategory(_input?: ReportDateRangeInput) {
      return []
    },
    async purchaseCostTracking(_input?: ReportDateRangeInput) {
      return []
    },
    async supplierPerformance(_input?: ReportDateRangeInput) {
      return []
    },
    async velocity(_input?: ReportDateRangeInput) {
      return []
    },
    async lowStockTrends() {
      return buildInventory().map((row) => ({
        productId: row.productId,
        productName: row.productName,
        sku: row.sku,
        onHand: row.onHand,
        reserved: row.reserved,
        available: row.available,
        reorderThreshold: row.reorderThreshold,
        lowStock: row.lowStock,
      }))
    },
  },
}
