export type Role = 'manager' | 'staff'

export type RecordStatus = 'active' | 'inactive'

export type SalesOrderStatus =
  | 'draft'
  | 'processing'
  | 'partially_shipped'
  | 'shipped'
  | 'cancelled'
  | 'confirmed'

export type PurchaseOrderStatus =
  | 'draft'
  | 'ordered'
  | 'partially_received'
  | 'received'
  | 'cancelled'

export type InventoryTxnType = 'IN' | 'OUT' | 'ADJUST'

export type InventoryRefType = 'SO' | 'PO' | 'ADJUSTMENT' | string

export interface BaseRecord {
  id: string
  version: number
  createdAt: string
  updatedAt: string
}

export interface Category extends BaseRecord {
  name: string
  description: string
  status: RecordStatus
}

export interface Product extends BaseRecord {
  name: string
  sku: string
  categoryId: string
  categoryName: string
  description?: string
  unit: string
  defaultSalePrice: number
  costPrice: number
  reorderThreshold: number
  status: RecordStatus
}

export interface Customer extends BaseRecord {
  name: string
  email: string
  phone: string
  address: string
  status: RecordStatus
  notes: string
}

export interface Supplier extends BaseRecord {
  name: string
  email: string
  phone: string
  address: string
  status: RecordStatus
  notes: string
}

export interface SalesOrderLine {
  id: string
  productId: string
  productName: string
  supplierId?: string
  supplierName?: string
  quantityOrdered: number
  quantityReserved: number
  quantityShipped: number
  unitPrice: number
  lineTotal: number
  quantity?: number
  shippedQuantity?: number
}

export interface PurchaseOrderLine {
  id: string
  productId: string
  productName: string
  quantityOrdered: number
  quantityReceived: number
  unitPrice: number
  lineTotal: number
  quantity?: number
  receivedQuantity?: number
}

export interface SalesOrder extends BaseRecord {
  customerId: string
  customerName: string
  date: string
  status: SalesOrderStatus
  lines: SalesOrderLine[]
}

export interface PurchaseOrder extends BaseRecord {
  supplierId: string
  supplierName: string
  date: string
  status: PurchaseOrderStatus
  lines: PurchaseOrderLine[]
}

export interface InventoryTransaction extends BaseRecord {
  productId: string
  productName: string
  sku: string
  quantity: number
  type: InventoryTxnType
  referenceType: InventoryRefType
  referenceId: string
  referenceLineId?: string
  unitPrice?: number
  reason?: string
  performedBy?: string
  performedByUsername: string
}

export interface InventoryRecord {
  productId: string
  productName: string
  sku: string
  onHand: number
  reserved: number
  available: number
  reorderThreshold: number
  lowStock: boolean
  currentQuantity?: number
}

export interface CommunicationLog {
  id: string
  documentType: string
  documentId: string
  recipient: string
  channel: string
  status: string
  senderUsername: string
  details: string
  createdAt: string
}

export interface EntityAuditLog {
  id: string
  entityType: string
  entityId: string
  action: string
  oldValue: string
  newValue: string
  performedBy?: string
  performedByUsername: string
  createdAt: string
}

export interface SalesByProductReportRow {
  productId: string
  productName: string
  sku: string
  shippedQuantity: number
  revenue: number
}

export interface SalesByCategoryReportRow {
  categoryName: string
  shippedQuantity: number
  revenue: number
}

export interface PurchaseCostTrackingReportRow {
  purchaseOrderId: string
  supplierId: string
  supplierName: string
  receivedCost: number
  orderDate: string
}

export interface SupplierPerformanceReportRow {
  supplierId: string
  supplierName: string
  totalOrders: number
  receivedOrders: number
  receiveRate: number
  avgLeadDays: number
}

export interface VelocityReportRow {
  productId: string
  productName: string
  sku: string
  inbound: number
  outbound: number
  net: number
}

export interface LowStockTrendReportRow {
  productId: string
  productName: string
  sku: string
  onHand: number
  reserved: number
  available: number
  reorderThreshold: number
  lowStock: boolean
  lastMovementAt?: string
}

export interface LoginInput {
  username: string
  password: string
}

export interface AuthClaims {
  username: string
  roles: Role[]
  exp: number
}

export interface LoginResponse {
  token: string
  claims: AuthClaims
}
