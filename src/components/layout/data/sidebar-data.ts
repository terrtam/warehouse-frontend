import {
  LayoutDashboard,
  Boxes,
  ClipboardList,
  FileSpreadsheet,
  Package,
  Users,
  Building2,
  Tags,
  Truck,
} from 'lucide-react'
import { type SidebarData } from '../types'

type SidebarInput = {
  username?: string
  roles?: string[]
}

const hasManagerRole = (roles: string[]) => roles.includes('manager')

export const createSidebarData = (input: SidebarInput): SidebarData => {
  const username = input.username ?? 'warehouse.user'
  const roles = input.roles ?? ['staff']
  const isManager = hasManagerRole(roles)
  const roleLabel = isManager ? 'Manager' : 'Staff'

  return {
    user: {
      name: username,
      email: `${username}@warehouse.local`,
      avatar: '/avatars/01.png',
    },
    teams: [
      {
        name: 'Warehouse Suite',
        logo: Boxes,
        plan: roleLabel,
      },
    ],
    navGroups: [
      {
        title: 'Operations',
        items: [
          {
            title: 'Dashboard',
            url: '/',
            icon: LayoutDashboard,
          },
          {
            title: 'Inventory',
            url: '/inventory',
            icon: Boxes,
          },
          {
            title: 'Inventory Txns',
            url: '/inventory-transactions',
            icon: FileSpreadsheet,
          },
          {
            title: 'Products',
            url: '/products',
            icon: Package,
          },
          {
            title: 'Sales Orders',
            url: '/sales-orders',
            icon: ClipboardList,
          },
          {
            title: 'Purchase Orders',
            url: '/purchase-orders',
            icon: Truck,
          },
          {
            title: 'Customers',
            url: '/customers',
            icon: Users,
          },
          ...(isManager
            ? [
                {
                  title: 'Categories',
                  url: '/categories',
                  icon: Tags,
                },
                {
                  title: 'Suppliers',
                  url: '/suppliers',
                  icon: Building2,
                },
              ]
            : []),
        ],
      },
    ],
  }
}

export const sidebarData = createSidebarData({})
