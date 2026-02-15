import { createFileRoute } from '@tanstack/react-router'
import { InventoryTransactions } from '@/features/inventory-transactions'
import { wmsGridSearchSchema } from '@/features/wms/search-schema'

export const Route = createFileRoute('/_authenticated/inventory-transactions/')({
  validateSearch: wmsGridSearchSchema,
  component: InventoryTransactions,
})

