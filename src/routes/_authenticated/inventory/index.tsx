import { createFileRoute } from '@tanstack/react-router'
import { Inventory } from '@/features/inventory'
import { wmsGridSearchSchema } from '@/features/wms/search-schema'

export const Route = createFileRoute('/_authenticated/inventory/')({
  validateSearch: wmsGridSearchSchema,
  component: Inventory,
})
