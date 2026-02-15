import { createFileRoute } from '@tanstack/react-router'
import { SalesOrders } from '@/features/sales-orders'
import { wmsGridSearchSchema } from '@/features/wms/search-schema'

export const Route = createFileRoute('/_authenticated/sales-orders/')({
  validateSearch: wmsGridSearchSchema,
  component: SalesOrders,
})

