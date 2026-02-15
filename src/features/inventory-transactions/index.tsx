import { useMemo } from 'react'
import type { ColDef } from 'ag-grid-community'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useGridUrlState } from '@/hooks/use-grid-url-state'
import { WmsGrid } from '@/components/ag-grid/wms-grid'
import { wmsQueryKeys, wmsRepository } from '@/services/wms'
import type { InventoryTransaction } from '@/domain/wms/types'
import { WmsPage } from '@/features/wms/components/wms-page'
import { GridToolbar } from '@/features/wms/components/grid-toolbar'
import { extractSortState, sortRows } from '@/features/wms/grid-utils'

const route = getRouteApi('/_authenticated/inventory-transactions/')

export function InventoryTransactions() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const { pagination, setPagination, q, setQuery, sortBy, sortDir, setSort } =
    useGridUrlState({
      search,
      navigate,
    })

  const txnsQuery = useQuery({
    queryKey: wmsQueryKeys.inventoryTransactions,
    queryFn: () => wmsRepository.inventoryTransactions.list(),
  })

  const rows = useMemo(() => {
    const lowered = q.toLowerCase()
    const filtered = (txnsQuery.data ?? []).filter((row) => {
      if (lowered.length === 0) return true
      return (
        row.productName.toLowerCase().includes(lowered) ||
        row.sku.toLowerCase().includes(lowered) ||
        row.referenceId.toLowerCase().includes(lowered) ||
        row.performedBy.toLowerCase().includes(lowered)
      )
    })
    return sortRows(filtered, sortBy, sortDir)
  }, [txnsQuery.data, q, sortBy, sortDir])

  const columns = useMemo<ColDef<InventoryTransaction>[]>(
    () => [
      { field: 'productName', headerName: 'Product' },
      { field: 'sku', headerName: 'SKU', maxWidth: 120 },
      { field: 'quantity', headerName: 'Qty', maxWidth: 100 },
      { field: 'type', headerName: 'Type', maxWidth: 100 },
      { field: 'referenceType', headerName: 'Ref Type', maxWidth: 120 },
      { field: 'referenceId', headerName: 'Ref ID', minWidth: 150 },
      { field: 'performedBy', headerName: 'User', maxWidth: 130 },
      {
        field: 'createdAt',
        headerName: 'Timestamp',
        minWidth: 180,
        valueFormatter: ({ value }) =>
          typeof value === 'string' ? new Date(value).toLocaleString() : '',
      },
    ],
    []
  )

  return (
    <WmsPage
      title='Inventory Transactions'
      description='Audit trail of all IN/OUT/ADJUST stock movements.'
    >
      <GridToolbar
        query={q}
        onQueryChange={setQuery}
        placeholder='Filter transactions by product, SKU, reference, or user...'
      />

      <WmsGrid<InventoryTransaction>
        rowData={rows}
        columnDefs={columns}
        loading={txnsQuery.isLoading}
        pagination={pagination}
        onPaginationChange={setPagination}
        onFilterChange={() => {}}
        onSortChange={(model) => {
          const next = extractSortState(model)
          setSort(next.sortBy, next.sortDir)
        }}
      />
    </WmsPage>
  )
}
