import type {
  AuthClaims,
  Category,
  Customer,
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
import { canRole } from '@/lib/auth/permissions'
import { mockRealtimeTransport } from '@/services/realtime/mock-transport'
import { realtimeTopics } from '@/services/realtime/transport'
import { WmsError } from './errors'
import type {
  Actor,
  CategoryInput,
  CreatePurchaseOrderInput,
  CreateSalesOrderInput,
  CustomerInput,
  ProductInput,
  PurchaseOrderLineInput,
  ReceiveLineInput,
  SalesOrderLineInput,
  ShipLineInput,
  SupplierInput,
  WmsRepository,
  AdjustmentInput,
} from './repository'

type DbState = {
  categories: Category[]
  products: Product[]
  customers: Customer[]
  suppliers: Supplier[]
  salesOrders: SalesOrder[]
  purchaseOrders: PurchaseOrder[]
  inventoryTransactions: InventoryTransaction[]
}

type MutableRecord = {
  id: string
  version: number
  updatedAt: string
}

const nowIso = () => new Date().toISOString()

const deepClone = <T>(value: T): T => structuredClone(value)

const toBase64Url = (value: string) =>
  btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const createMockJwt = (claims: AuthClaims) => {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = toBase64Url(
    JSON.stringify({
      sub: claims.username,
      role: claims.roles[0],
      exp: Math.floor(claims.exp / 1000),
    })
  )
  const signature = toBase64Url('mock-signature')
  return `${header}.${payload}.${signature}`
}

const nextId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now()
    .toString(36)
    .slice(-4)}`

const touch = <T extends MutableRecord>(record: T) => {
  record.version += 1
  record.updatedAt = nowIso()
}

const findById = <T extends { id: string }>(rows: T[], id: string, label: string) => {
  const found = rows.find((row) => row.id === id)
  if (!found) {
    throw new WmsError('NOT_FOUND', `${label} not found`)
  }
  return found
}

const assertPositiveInteger = (value: number, label: string) => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new WmsError('VALIDATION', `${label} must be a positive integer`)
  }
}

const assertManager = (actor: Actor, action: string) => {
  if (actor.role !== 'manager') {
    throw new WmsError('FORBIDDEN', `${action} is manager only`)
  }
}

const assertPermission = (actor: Actor, action: Parameters<typeof canRole>[1]) => {
  if (!canRole(actor.role, action)) {
    throw new WmsError('FORBIDDEN', 'You do not have permission for this action')
  }
}

const assertVersion = (expectedVersion: number | undefined, currentVersion: number) => {
  if (expectedVersion === undefined) return
  if (expectedVersion !== currentVersion) {
    throw new WmsError(
      'CONFLICT',
      'Record has been changed by another user',
      'Version mismatch'
    )
  }
}

const getInventoryTotals = (state: DbState) => {
  const totals = new Map<string, number>()
  state.inventoryTransactions.forEach((txn) => {
    const current = totals.get(txn.productId) ?? 0
    const delta =
      txn.type === 'IN' ? txn.quantity : txn.type === 'OUT' ? -txn.quantity : txn.quantity
    totals.set(txn.productId, current + delta)
  })
  return totals
}

const buildInventory = (state: DbState): InventoryRecord[] => {
  const totals = getInventoryTotals(state)
  return state.products.map((product) => {
    const currentQuantity = totals.get(product.id) ?? 0
    return {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      currentQuantity,
      reorderThreshold: product.reorderThreshold,
      lowStock: currentQuantity <= product.reorderThreshold,
    }
  })
}

const inventoryForProduct = (state: DbState, productId: string) => {
  const inventory = buildInventory(state).find((item) => item.productId === productId)
  if (!inventory) {
    throw new WmsError('NOT_FOUND', 'Inventory product not found')
  }
  return inventory
}

const addInventoryTransaction = (
  state: DbState,
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

const validateSkuUnique = (state: DbState, sku: string, excludeId?: string) => {
  const taken = state.products.some(
    (product) => product.sku.toLowerCase() === sku.toLowerCase() && product.id !== excludeId
  )
  if (taken) {
    throw new WmsError('VALIDATION', 'SKU must be unique')
  }
}

const validateCategory = (state: DbState, categoryId: string) => {
  const category = findById(state.categories, categoryId, 'Category')
  if (category.status !== 'active') {
    throw new WmsError('VALIDATION', 'Category must be active')
  }
  return category
}

const validateSalesOrderLines = (state: DbState, lines: SalesOrderLineInput[]) => {
  if (lines.length === 0) {
    throw new WmsError('VALIDATION', 'Sales order requires at least one line')
  }

  return lines.map((line): SalesOrderLine => {
    assertPositiveInteger(line.quantity, 'Line quantity')
    const product = findById(state.products, line.productId, 'Product')
    if (product.status !== 'active') {
      throw new WmsError(
        'VALIDATION',
        `Inactive product "${product.name}" cannot be added to new orders`
      )
    }

    return {
      id: nextId('sol'),
      productId: product.id,
      productName: product.name,
      quantity: line.quantity,
      shippedQuantity: 0,
      unitPrice: line.unitPrice ?? product.defaultSalePrice,
    }
  })
}

const validatePurchaseOrderLines = (state: DbState, lines: PurchaseOrderLineInput[]) => {
  if (lines.length === 0) {
    throw new WmsError('VALIDATION', 'Purchase order requires at least one line')
  }

  return lines.map((line): PurchaseOrderLine => {
    assertPositiveInteger(line.quantity, 'Line quantity')
    const product = findById(state.products, line.productId, 'Product')
    if (product.status !== 'active') {
      throw new WmsError(
        'VALIDATION',
        `Inactive product "${product.name}" cannot be added to new orders`
      )
    }

    return {
      id: nextId('pol'),
      productId: product.id,
      productName: product.name,
      quantity: line.quantity,
      receivedQuantity: 0,
      unitPrice: line.unitPrice ?? product.costPrice,
    }
  })
}

const seed = (): DbState => {
  const createdAt = nowIso()
  const categories: Category[] = [
    {
      id: 'cat-electronics',
      name: 'Electronics',
      status: 'active',
      version: 1,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'cat-household',
      name: 'Household',
      status: 'active',
      version: 1,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'cat-seasonal',
      name: 'Seasonal',
      status: 'inactive',
      version: 1,
      createdAt,
      updatedAt: createdAt,
    },
  ]

  const products: Product[] = [
    {
      id: 'prd-wireless-scanner',
      name: 'Wireless Scanner',
      sku: 'WH-1001',
      categoryId: 'cat-electronics',
      categoryName: 'Electronics',
      unit: 'pcs',
      defaultSalePrice: 129.99,
      costPrice: 80,
      reorderThreshold: 20,
      status: 'active',
      version: 1,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'prd-label-printer',
      name: 'Label Printer',
      sku: 'WH-1002',
      categoryId: 'cat-electronics',
      categoryName: 'Electronics',
      unit: 'pcs',
      defaultSalePrice: 289,
      costPrice: 200,
      reorderThreshold: 10,
      status: 'active',
      version: 1,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'prd-shipping-box',
      name: 'Shipping Box Large',
      sku: 'WH-2001',
      categoryId: 'cat-household',
      categoryName: 'Household',
      unit: 'box',
      defaultSalePrice: 4.5,
      costPrice: 2.2,
      reorderThreshold: 100,
      status: 'active',
      version: 1,
      createdAt,
      updatedAt: createdAt,
    },
  ]

  const customers: Customer[] = [
    {
      id: 'cus-acme',
      name: 'ACME Retail',
      contactInfo: 'buyer@acme.example, +1 555 1000',
      address: '120 River St, Austin, TX',
      status: 'active',
      version: 1,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'cus-zenith',
      name: 'Zenith Stores',
      contactInfo: 'ops@zenith.example, +1 555 2000',
      address: '45 Pine Ave, Seattle, WA',
      status: 'active',
      version: 1,
      createdAt,
      updatedAt: createdAt,
    },
  ]

  const suppliers: Supplier[] = [
    {
      id: 'sup-apex',
      name: 'Apex Supply Co.',
      contactInfo: 'sales@apex.example, +1 555 3000',
      address: '9 Industrial Rd, Denver, CO',
      status: 'active',
      version: 1,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'sup-north',
      name: 'Northline Distribution',
      contactInfo: 'contact@northline.example, +1 555 4000',
      address: '200 Logistics Pkwy, Columbus, OH',
      status: 'active',
      version: 1,
      createdAt,
      updatedAt: createdAt,
    },
  ]

  const inventoryTransactions: InventoryTransaction[] = [
    {
      id: nextId('txn'),
      productId: 'prd-wireless-scanner',
      productName: 'Wireless Scanner',
      sku: 'WH-1001',
      quantity: 60,
      type: 'IN',
      referenceType: 'PO',
      referenceId: 'seed-po-1',
      performedBy: 'seed',
      version: 1,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: nextId('txn'),
      productId: 'prd-label-printer',
      productName: 'Label Printer',
      sku: 'WH-1002',
      quantity: 30,
      type: 'IN',
      referenceType: 'PO',
      referenceId: 'seed-po-2',
      performedBy: 'seed',
      version: 1,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: nextId('txn'),
      productId: 'prd-shipping-box',
      productName: 'Shipping Box Large',
      sku: 'WH-2001',
      quantity: 250,
      type: 'IN',
      referenceType: 'PO',
      referenceId: 'seed-po-3',
      performedBy: 'seed',
      version: 1,
      createdAt,
      updatedAt: createdAt,
    },
  ]

  const salesOrders: SalesOrder[] = []
  const purchaseOrders: PurchaseOrder[] = []

  return {
    categories,
    products,
    customers,
    suppliers,
    salesOrders,
    purchaseOrders,
    inventoryTransactions,
  }
}

const state: DbState = seed()

const publishProducts = (type: string, id: string) => {
  mockRealtimeTransport.publish(realtimeTopics.products, { type, id, at: nowIso() })
}

const publishInventory = (type: string, id: string) => {
  mockRealtimeTransport.publish(realtimeTopics.inventory, { type, id, at: nowIso() })
}

const publishOrders = (type: string, id: string) => {
  mockRealtimeTransport.publish(realtimeTopics.orders, { type, id, at: nowIso() })
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

      return {
        token: createMockJwt(claims),
        claims,
      }
    },
  },
  categories: {
    async list() {
      return deepClone(state.categories)
    },
    async create(input: CategoryInput, actor: Actor) {
      assertManager(actor, 'Creating categories')
      const timestamp = nowIso()
      const category: Category = {
        id: nextId('cat'),
        name: input.name.trim(),
        status: input.status,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      state.categories.unshift(category)
      publishProducts('category.created', category.id)
      return deepClone(category)
    },
    async update(id, input, actor, expectedVersion) {
      assertManager(actor, 'Updating categories')
      const category = findById(state.categories, id, 'Category')
      assertVersion(expectedVersion, category.version)
      category.name = input.name.trim()
      category.status = input.status
      touch(category)
      publishProducts('category.updated', category.id)
      return deepClone(category)
    },
  },
  products: {
    async list() {
      return deepClone(state.products)
    },
    async create(input: ProductInput, actor: Actor) {
      assertManager(actor, 'Creating products')
      validateSkuUnique(state, input.sku)
      const category = validateCategory(state, input.categoryId)
      const timestamp = nowIso()
      const product: Product = {
        id: nextId('prd'),
        name: input.name.trim(),
        sku: input.sku.trim(),
        categoryId: category.id,
        categoryName: category.name,
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
      publishProducts('product.created', product.id)
      publishInventory('inventory.product.created', product.id)
      return deepClone(product)
    },
    async update(id, input, actor, expectedVersion) {
      assertManager(actor, 'Updating products')
      const product = findById(state.products, id, 'Product')
      assertVersion(expectedVersion, product.version)
      validateSkuUnique(state, input.sku, id)
      const category = validateCategory(state, input.categoryId)
      product.name = input.name.trim()
      product.sku = input.sku.trim()
      product.categoryId = category.id
      product.categoryName = category.name
      product.unit = input.unit.trim()
      product.defaultSalePrice = input.defaultSalePrice
      product.costPrice = input.costPrice
      product.reorderThreshold = input.reorderThreshold
      product.status = input.status
      touch(product)
      publishProducts('product.updated', product.id)
      publishInventory('inventory.product.updated', product.id)
      return deepClone(product)
    },
  },
  customers: {
    async list() {
      return deepClone(state.customers)
    },
    async create(input: CustomerInput, actor: Actor) {
      assertManager(actor, 'Creating customers')
      const timestamp = nowIso()
      const customer: Customer = {
        id: nextId('cus'),
        name: input.name.trim(),
        contactInfo: input.contactInfo.trim(),
        address: input.address.trim(),
        status: input.status,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      state.customers.unshift(customer)
      return deepClone(customer)
    },
    async update(id, input, actor, expectedVersion) {
      assertManager(actor, 'Updating customers')
      const customer = findById(state.customers, id, 'Customer')
      assertVersion(expectedVersion, customer.version)
      customer.name = input.name.trim()
      customer.contactInfo = input.contactInfo.trim()
      customer.address = input.address.trim()
      customer.status = input.status
      touch(customer)
      return deepClone(customer)
    },
  },
  suppliers: {
    async list() {
      return deepClone(state.suppliers)
    },
    async create(input: SupplierInput, actor: Actor) {
      assertManager(actor, 'Creating suppliers')
      const timestamp = nowIso()
      const supplier: Supplier = {
        id: nextId('sup'),
        name: input.name.trim(),
        contactInfo: input.contactInfo.trim(),
        address: input.address.trim(),
        status: input.status,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      state.suppliers.unshift(supplier)
      return deepClone(supplier)
    },
    async update(id, input, actor, expectedVersion) {
      assertManager(actor, 'Updating suppliers')
      const supplier = findById(state.suppliers, id, 'Supplier')
      assertVersion(expectedVersion, supplier.version)
      supplier.name = input.name.trim()
      supplier.contactInfo = input.contactInfo.trim()
      supplier.address = input.address.trim()
      supplier.status = input.status
      touch(supplier)
      return deepClone(supplier)
    },
  },
  salesOrders: {
    async list() {
      return deepClone(state.salesOrders)
    },
    async create(input: CreateSalesOrderInput, actor: Actor) {
      assertPermission(actor, 'sales-orders:create')
      const customer = findById(state.customers, input.customerId, 'Customer')
      const lines = validateSalesOrderLines(state, input.lines)
      const timestamp = nowIso()
      const order: SalesOrder = {
        id: nextId('so'),
        customerId: customer.id,
        customerName: customer.name,
        status: 'draft',
        lines,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      state.salesOrders.unshift(order)
      publishOrders('sales-order.created', order.id)
      return deepClone(order)
    },
    async confirm(id, actor, expectedVersion) {
      assertPermission(actor, 'sales-orders:confirm')
      const order = findById(state.salesOrders, id, 'Sales order')
      assertVersion(expectedVersion, order.version)
      if (order.status !== 'draft') {
        throw new WmsError('VALIDATION', 'Only draft sales orders can be confirmed')
      }
      order.status = 'confirmed'
      touch(order)
      publishOrders('sales-order.confirmed', order.id)
      return deepClone(order)
    },
    async ship(id, lineShipments: ShipLineInput[], actor, expectedVersion) {
      assertPermission(actor, 'sales-orders:ship')
      const order = findById(state.salesOrders, id, 'Sales order')
      assertVersion(expectedVersion, order.version)
      if (order.status === 'draft') {
        throw new WmsError('VALIDATION', 'Orders must be confirmed before shipping')
      }
      if (order.status === 'cancelled') {
        throw new WmsError('VALIDATION', 'Cancelled orders cannot modify inventory')
      }
      if (order.status === 'shipped') {
        throw new WmsError('VALIDATION', 'Order is already shipped')
      }
      if (lineShipments.length === 0) {
        throw new WmsError('VALIDATION', 'Provide at least one line shipment')
      }

      lineShipments.forEach((shipment) => {
        assertPositiveInteger(shipment.quantity, 'Shipment quantity')
        const line = findById(order.lines, shipment.lineId, 'Sales order line')
        const remaining = line.quantity - line.shippedQuantity
        if (shipment.quantity > remaining) {
          throw new WmsError(
            'VALIDATION',
            `Cannot ship more than remaining quantity for ${line.productName}`
          )
        }

        const inventory = inventoryForProduct(state, line.productId)
        if (inventory.currentQuantity < shipment.quantity) {
          throw new WmsError(
            'INSUFFICIENT_INVENTORY',
            'Insufficient inventory for shipment',
            `${line.productName}: requested ${shipment.quantity}, available ${inventory.currentQuantity}`
          )
        }
      })

      lineShipments.forEach((shipment) => {
        const line = findById(order.lines, shipment.lineId, 'Sales order line')
        line.shippedQuantity += shipment.quantity
        const product = findById(state.products, line.productId, 'Product')

        addInventoryTransaction(state, {
          productId: line.productId,
          productName: line.productName,
          sku: product.sku,
          quantity: shipment.quantity,
          type: 'OUT',
          referenceType: 'SO',
          referenceId: order.id,
          performedBy: actor.username,
        })
      })

      const allShipped = order.lines.every((line) => line.shippedQuantity >= line.quantity)
      order.status = allShipped ? 'shipped' : 'partially_shipped'
      touch(order)
      publishOrders('sales-order.shipped', order.id)
      publishInventory('inventory.shipped', order.id)
      return deepClone(order)
    },
    async cancel(id, actor, expectedVersion) {
      assertPermission(actor, 'sales-orders:cancel')
      const order = findById(state.salesOrders, id, 'Sales order')
      assertVersion(expectedVersion, order.version)
      if (order.status === 'shipped' || order.status === 'partially_shipped') {
        throw new WmsError(
          'VALIDATION',
          'Shipped or partially shipped orders cannot be cancelled'
        )
      }
      if (order.status !== 'cancelled') {
        order.status = 'cancelled'
        touch(order)
      }
      publishOrders('sales-order.cancelled', order.id)
      return deepClone(order)
    },
  },
  purchaseOrders: {
    async list() {
      return deepClone(state.purchaseOrders)
    },
    async create(input: CreatePurchaseOrderInput, actor: Actor) {
      assertPermission(actor, 'purchase-orders:create')
      const supplier = findById(state.suppliers, input.supplierId, 'Supplier')
      const lines = validatePurchaseOrderLines(state, input.lines)
      const timestamp = nowIso()
      const order: PurchaseOrder = {
        id: nextId('po'),
        supplierId: supplier.id,
        supplierName: supplier.name,
        status: 'draft',
        lines,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      state.purchaseOrders.unshift(order)
      publishOrders('purchase-order.created', order.id)
      return deepClone(order)
    },
    async order(id, actor, expectedVersion) {
      assertPermission(actor, 'purchase-orders:order')
      const order = findById(state.purchaseOrders, id, 'Purchase order')
      assertVersion(expectedVersion, order.version)
      if (order.status !== 'draft') {
        throw new WmsError('VALIDATION', 'Only draft purchase orders can be ordered')
      }
      order.status = 'ordered'
      touch(order)
      publishOrders('purchase-order.ordered', order.id)
      return deepClone(order)
    },
    async receive(id, lineReceipts: ReceiveLineInput[], actor, expectedVersion) {
      assertPermission(actor, 'purchase-orders:receive')
      const order = findById(state.purchaseOrders, id, 'Purchase order')
      assertVersion(expectedVersion, order.version)
      if (order.status === 'draft') {
        throw new WmsError(
          'VALIDATION',
          'Purchase orders must be ordered before receiving'
        )
      }
      if (order.status === 'cancelled') {
        throw new WmsError('VALIDATION', 'Cancelled orders cannot modify inventory')
      }
      if (order.status === 'received') {
        throw new WmsError('VALIDATION', 'Order is already received')
      }
      if (lineReceipts.length === 0) {
        throw new WmsError('VALIDATION', 'Provide at least one line receipt')
      }

      lineReceipts.forEach((receipt) => {
        assertPositiveInteger(receipt.quantity, 'Receipt quantity')
        const line = findById(order.lines, receipt.lineId, 'Purchase order line')
        const remaining = line.quantity - line.receivedQuantity
        if (receipt.quantity > remaining) {
          throw new WmsError(
            'VALIDATION',
            `Cannot receive more than remaining quantity for ${line.productName}`
          )
        }
      })

      lineReceipts.forEach((receipt) => {
        const line = findById(order.lines, receipt.lineId, 'Purchase order line')
        line.receivedQuantity += receipt.quantity
        const product = findById(state.products, line.productId, 'Product')
        addInventoryTransaction(state, {
          productId: line.productId,
          productName: line.productName,
          sku: product.sku,
          quantity: receipt.quantity,
          type: 'IN',
          referenceType: 'PO',
          referenceId: order.id,
          performedBy: actor.username,
        })
      })

      const fullyReceived = order.lines.every((line) => line.receivedQuantity >= line.quantity)
      order.status = fullyReceived ? 'received' : 'partially_received'
      touch(order)
      publishOrders('purchase-order.received', order.id)
      publishInventory('inventory.received', order.id)
      return deepClone(order)
    },
    async cancel(id, actor, expectedVersion) {
      assertPermission(actor, 'purchase-orders:cancel')
      const order = findById(state.purchaseOrders, id, 'Purchase order')
      assertVersion(expectedVersion, order.version)
      if (order.status === 'received' || order.status === 'partially_received') {
        throw new WmsError(
          'VALIDATION',
          'Received or partially received orders cannot be cancelled'
        )
      }
      if (order.status !== 'cancelled') {
        order.status = 'cancelled'
        touch(order)
      }
      publishOrders('purchase-order.cancelled', order.id)
      return deepClone(order)
    },
  },
  inventory: {
    async list() {
      return deepClone(buildInventory(state))
    },
    async adjust(input: AdjustmentInput, actor: Actor) {
      assertPermission(actor, 'inventory:adjust')
      if (!input.reason.trim()) {
        throw new WmsError('VALIDATION', 'Adjustment reason is required')
      }
      if (input.quantityDelta === 0) {
        throw new WmsError('VALIDATION', 'Adjustment quantity cannot be zero')
      }

      const product = findById(state.products, input.productId, 'Product')
      const current = inventoryForProduct(state, input.productId)
      const nextQuantity = current.currentQuantity + input.quantityDelta
      if (nextQuantity < 0) {
        const canOverride = actor.role === 'manager' && input.allowNegativeOverride
        if (!canOverride) {
          throw new WmsError(
            'INSUFFICIENT_INVENTORY',
            'Inventory cannot go negative without override permission'
          )
        }
      }

      addInventoryTransaction(state, {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantity: input.quantityDelta,
        type: 'ADJUST',
        referenceType: 'ADJUSTMENT',
        referenceId: nextId('adj'),
        reason: input.reason.trim(),
        performedBy: actor.username,
      })

      publishInventory('inventory.adjusted', product.id)
      const updated = inventoryForProduct(state, product.id)
      return deepClone(updated)
    },
  },
  inventoryTransactions: {
    async list() {
      return deepClone(state.inventoryTransactions)
    },
  },
}
