import { createFileRoute } from '@tanstack/react-router'
import { Suppliers } from '@/features/suppliers'
import { wmsGridSearchSchema } from '@/features/wms/search-schema'

export const Route = createFileRoute('/_authenticated/suppliers/')({
  validateSearch: wmsGridSearchSchema,
  component: Suppliers,
})
