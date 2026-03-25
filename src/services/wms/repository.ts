import type {
  Category,
  CommunicationLog,
  Customer,
  EntityAuditLog,
  InventoryRecord,
  InventoryTransaction,
  LoginInput,
  LoginResponse,
  LowStockTrendReportRow,
  Product,
  PurchaseCostTrackingReportRow,
  PurchaseOrder,
  Role,
  SalesByCategoryReportRow,
  SalesByProductReportRow,
  SalesOrder,
  Supplier,
  SupplierPerformanceReportRow,
  VelocityReportRow,
} from '@/domain/wms/types'

export type Actor = {
  username: string
  role: Role
}

export type CategoryInput = Pick<Category, 'name' | 'description' | 'status'>

export type ProductInput = Pick<
  Product,
  | 'name'
  | 'sku'
  | 'categoryId'
  | 'categoryName'
  | 'description'
  | 'unit'
  | 'defaultSalePrice'
  | 'costPrice'
  | 'reorderThreshold'
  | 'status'
>

export type CustomerInput = Pick<
  Customer,
  'name' | 'email' | 'phone' | 'address' | 'status' | 'notes'
>

export type CustomerListInput = {
  updatedAfter?: string
  page?: number
  size?: number
}

export type SupplierInput = Pick<
  Supplier,
  'name' | 'email' | 'phone' | 'address' | 'status' | 'notes'
>

export type SalesOrderLineInput = {
  productId: string
  supplierId?: string
  quantity: number
  unitPrice?: number
}

export type PurchaseOrderLineInput = {
  productId: string
  quantity: number
  unitPrice?: number
}

export type CreateSalesOrderInput = {
  customerId: string
  lines: SalesOrderLineInput[]
}

export type CreatePurchaseOrderInput = {
  supplierId: string
  lines: PurchaseOrderLineInput[]
}

export type AdjustmentInput = {
  productId: string
  quantityDelta: number
  reason: string
  allowNegativeOverride?: boolean
  unitPrice?: number
}

export type ShipLineInput = {
  lineId: string
  quantity: number
}

export type ReceiveLineInput = {
  lineId: string
  quantity: number
}

export type CommunicationListInput = {
  documentType?: string
  channel?: string
  status?: string
}

export type AuditLogListInput = {
  entityType?: string
}

export type ReportDateRangeInput = {
  from?: string
  to?: string
}

export interface AuthRepository {
  login(input: LoginInput): Promise<LoginResponse>
}

export interface CategoryRepository {
  list(): Promise<Category[]>
  create(input: CategoryInput, actor: Actor): Promise<Category>
  update(
    id: string,
    input: CategoryInput,
    actor: Actor,
    expectedVersion?: number
  ): Promise<Category>
}

export interface ProductRepository {
  list(): Promise<Product[]>
  create(input: ProductInput, actor: Actor): Promise<Product>
  update(
    id: string,
    input: ProductInput,
    actor: Actor,
    expectedVersion?: number
  ): Promise<Product>
  delete(id: string, actor: Actor, expectedVersion?: number): Promise<void>
}

export interface CustomerRepository {
  list(input?: CustomerListInput): Promise<Customer[]>
  create(input: CustomerInput, actor: Actor): Promise<Customer>
  update(
    id: string,
    input: CustomerInput,
    actor: Actor,
    expectedVersion?: number
  ): Promise<Customer>
}

export interface SupplierRepository {
  list(): Promise<Supplier[]>
  create(input: SupplierInput, actor: Actor): Promise<Supplier>
  update(
    id: string,
    input: SupplierInput,
    actor: Actor,
    expectedVersion?: number
  ): Promise<Supplier>
}

export interface SalesOrderRepository {
  list(): Promise<SalesOrder[]>
  create(input: CreateSalesOrderInput, actor: Actor): Promise<SalesOrder>
  confirm(id: string, actor: Actor, expectedVersion?: number): Promise<SalesOrder>
  ship(
    id: string,
    lines: ShipLineInput[],
    actor: Actor,
    expectedVersion?: number
  ): Promise<SalesOrder>
  cancel(id: string, actor: Actor, expectedVersion?: number): Promise<SalesOrder>
}

export interface PurchaseOrderRepository {
  list(): Promise<PurchaseOrder[]>
  create(input: CreatePurchaseOrderInput, actor: Actor): Promise<PurchaseOrder>
  order(id: string, actor: Actor, expectedVersion?: number): Promise<PurchaseOrder>
  receive(
    id: string,
    lines: ReceiveLineInput[],
    actor: Actor,
    expectedVersion?: number
  ): Promise<PurchaseOrder>
  cancel(id: string, actor: Actor, expectedVersion?: number): Promise<PurchaseOrder>
}

export interface InventoryRepository {
  list(): Promise<InventoryRecord[]>
  adjust(input: AdjustmentInput, actor: Actor): Promise<InventoryRecord>
}

export interface InventoryTransactionRepository {
  list(): Promise<InventoryTransaction[]>
}

export interface CommunicationRepository {
  list(input?: CommunicationListInput): Promise<CommunicationLog[]>
}

export interface AuditLogRepository {
  list(input?: AuditLogListInput): Promise<EntityAuditLog[]>
}

export interface ReportsRepository {
  salesByProduct(input?: ReportDateRangeInput): Promise<SalesByProductReportRow[]>
  salesByCategory(input?: ReportDateRangeInput): Promise<SalesByCategoryReportRow[]>
  purchaseCostTracking(
    input?: ReportDateRangeInput
  ): Promise<PurchaseCostTrackingReportRow[]>
  supplierPerformance(
    input?: ReportDateRangeInput
  ): Promise<SupplierPerformanceReportRow[]>
  velocity(input?: ReportDateRangeInput): Promise<VelocityReportRow[]>
  lowStockTrends(): Promise<LowStockTrendReportRow[]>
}

export interface WmsRepository {
  auth: AuthRepository
  products: ProductRepository
  categories: CategoryRepository
  customers: CustomerRepository
  suppliers: SupplierRepository
  salesOrders: SalesOrderRepository
  purchaseOrders: PurchaseOrderRepository
  inventory: InventoryRepository
  inventoryTransactions: InventoryTransactionRepository
  communications: CommunicationRepository
  auditLog: AuditLogRepository
  reports: ReportsRepository
}
