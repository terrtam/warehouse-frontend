import { createFileRoute } from '@tanstack/react-router'
import { Categories } from '@/features/categories'
import { wmsGridSearchSchema } from '@/features/wms/search-schema'

export const Route = createFileRoute('/_authenticated/categories/')({
  validateSearch: wmsGridSearchSchema,
  component: Categories,
})
