export type Role = 'manager' | 'staff'

export type RecordStatus = 'active' | 'inactive'

export type SalesOrderStatus =
  | 'draft'
  | 'confirmed'
  | 'partially_shipped'
  | 'shipped'
  | 'cancelled'

export type PurchaseOrderStatus =
  | 'draft'
  | 'ordered'
  | 'partially_received'
  | 'received'
  | 'cancelled'

export type InventoryTxnType = 'IN' | 'OUT' | 'ADJUST'

export type InventoryRefType = 'SO' | 'PO' | 'ADJUSTMENT'

export interface BaseRecord {
  id: string
  version: number
  createdAt: string
  updatedAt: string
}

export interface Category extends BaseRecord {
  name: string
  status: RecordStatus
}

export interface Product extends BaseRecord {
  name: string
  sku: string
  categoryId: string
  categoryName: string
  unit: string
  defaultSalePrice: number
  costPrice: number
  reorderThreshold: number
  status: RecordStatus
}

export interface Customer extends BaseRecord {
  name: string
  contactInfo: string
  address: string
  status: RecordStatus
}

export interface Supplier extends BaseRecord {
  name: string
  contactInfo: string
  address: string
  status: RecordStatus
}

export interface SalesOrderLine {
  id: string
  productId: string
  productName: string
  quantity: number
  shippedQuantity: number
  unitPrice: number
}

export interface PurchaseOrderLine {
  id: string
  productId: string
  productName: string
  quantity: number
  receivedQuantity: number
  unitPrice: number
}

export interface SalesOrder extends BaseRecord {
  customerId: string
  customerName: string
  status: SalesOrderStatus
  lines: SalesOrderLine[]
}

export interface PurchaseOrder extends BaseRecord {
  supplierId: string
  supplierName: string
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
  reason?: string
  performedBy: string
}

export interface InventoryRecord {
  productId: string
  productName: string
  sku: string
  currentQuantity: number
  reorderThreshold: number
  lowStock: boolean
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

