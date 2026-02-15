import { createFileRoute } from '@tanstack/react-router'
import { Customers } from '@/features/customers'
import { wmsGridSearchSchema } from '@/features/wms/search-schema'

export const Route = createFileRoute('/_authenticated/customers/')({
  validateSearch: wmsGridSearchSchema,
  component: Customers,
})
