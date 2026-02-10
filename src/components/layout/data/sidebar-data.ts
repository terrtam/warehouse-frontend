import {
  LayoutDashboard,
  Boxes,
  ShoppingCart,
  Package,
  Users,
  UserCog,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'Warehouse Admin',
    email: 'admin@warehouse.com',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [
    {
      name: 'Warehouse Suite',
      logo: Boxes,
      plan: 'Operations',
    },
  ],
  navGroups: [
    {
      title: 'Main',
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
          title: 'Orders',
          url: '/orders',
          icon: ShoppingCart,
        },
        {
          title: 'Products',
          url: '/products',
          icon: Package,
        },
        {
          title: 'Customers',
          url: '/customers',
          icon: Users,
        },
        {
          title: 'User Management',
          url: '/user-management',
          icon: UserCog,
        },
      ],
    },
  ],
}
