import { createFileRoute } from '@tanstack/react-router'
import { PurchaseOrders } from '@/features/purchase-orders'
import { wmsGridSearchSchema } from '@/features/wms/search-schema'

export const Route = createFileRoute('/_authenticated/purchase-orders/')({
  validateSearch: wmsGridSearchSchema,
  component: PurchaseOrders,
})

