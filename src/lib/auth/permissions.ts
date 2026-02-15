import type { Role } from '@/domain/wms/types'

export type WmsAction =
  | 'products:view'
  | 'products:manage'
  | 'categories:manage'
  | 'customers:view'
  | 'customers:manage'
  | 'suppliers:manage'
  | 'sales-orders:view'
  | 'sales-orders:create'
  | 'sales-orders:confirm'
  | 'sales-orders:ship'
  | 'sales-orders:cancel'
  | 'purchase-orders:view'
  | 'purchase-orders:create'
  | 'purchase-orders:order'
  | 'purchase-orders:receive'
  | 'purchase-orders:cancel'
  | 'inventory:view'
  | 'inventory:adjust'
  | 'inventory:override-negative'
  | 'inventory-transactions:view'
  | 'dashboard:reports'

const managerActions = new Set<WmsAction>([
  'products:view',
  'products:manage',
  'categories:manage',
  'customers:view',
  'customers:manage',
  'suppliers:manage',
  'sales-orders:view',
  'sales-orders:create',
  'sales-orders:confirm',
  'sales-orders:ship',
  'sales-orders:cancel',
  'purchase-orders:view',
  'purchase-orders:create',
  'purchase-orders:order',
  'purchase-orders:receive',
  'purchase-orders:cancel',
  'inventory:view',
  'inventory:adjust',
  'inventory:override-negative',
  'inventory-transactions:view',
  'dashboard:reports',
])

const staffActions = new Set<WmsAction>([
  'products:view',
  'customers:view',
  'sales-orders:view',
  'sales-orders:ship',
  'purchase-orders:view',
  'purchase-orders:receive',
  'inventory:view',
  'inventory:adjust',
  'inventory-transactions:view',
])

export const canRole = (role: Role, action: WmsAction): boolean => {
  if (role === 'manager') return managerActions.has(action)
  return staffActions.has(action)
}

export const canAnyRole = (roles: Role[], action: WmsAction): boolean =>
  roles.some((role) => canRole(role, action))

