import type {
  Category,
  Customer,
  InventoryRecord,
  InventoryTransaction,
  LoginInput,
  LoginResponse,
  Product,
  PurchaseOrder,
  PurchaseOrderLine,
  Role,
  SalesOrder,
  SalesOrderLine,
  Supplier,
} from '@/domain/wms/types'

export type Actor = {
  username: string
  role: Role
}

export type CategoryInput = Pick<Category, 'name' | 'status'>

export type ProductInput = Pick<
  Product,
  | 'name'
  | 'sku'
  | 'categoryId'
  | 'unit'
  | 'defaultSalePrice'
  | 'costPrice'
  | 'reorderThreshold'
  | 'status'
>

export type CustomerInput = Pick<
  Customer,
  'name' | 'email' | 'phone' | 'status'
>

export type CustomerListInput = {
  updatedAfter?: string
  page?: number
  size?: number
}

export type SupplierInput = Pick<
  Supplier,
  'name' | 'email' | 'phone' | 'address' | 'status'
>

export type SalesOrderLineInput = Pick<SalesOrderLine, 'productId' | 'quantity'> & {
  unitPrice?: number
}

export type PurchaseOrderLineInput = Pick<
  PurchaseOrderLine,
  'productId' | 'quantity'
> & {
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
}

export type ShipLineInput = {
  lineId: string
  quantity: number
}

export type ReceiveLineInput = {
  lineId: string
  quantity: number
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
}
