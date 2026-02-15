import { useEffect, useMemo, useRef } from 'react'
import {
  themeQuartz,
  type ColDef,
  type FilterChangedEvent,
  type GridReadyEvent,
  type PaginationChangedEvent,
  type SortChangedEvent,
  type Theme,
} from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'
import { useTheme } from '@/context/theme-provider'
import { cn } from '@/lib/utils'

export interface WmsGridProps<T> {
  rowData: T[]
  columnDefs: ColDef<T>[]
  loading?: boolean
  pagination: { page: number; pageSize: number }
  onPaginationChange: (next: { page: number; pageSize: number }) => void
  onFilterChange: (model: unknown) => void
  onSortChange: (model: unknown) => void
  className?: string
  onRowClicked?: (row: T) => void
}

export function WmsGrid<T>({
  rowData,
  columnDefs,
  loading = false,
  pagination,
  onPaginationChange,
  onFilterChange,
  onSortChange,
  className,
  onRowClicked,
}: WmsGridProps<T>) {
  const gridApiRef = useRef<GridReadyEvent<T>['api'] | null>(null)
  const { resolvedTheme } = useTheme()

  const defaultColDef = useMemo<ColDef<T>>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      floatingFilter: false,
      minWidth: 120,
    }),
    []
  )

  const theme = useMemo<Theme>(
    () =>
      themeQuartz.withParams({
        backgroundColor: 'var(--card)',
        foregroundColor: 'var(--foreground)',
        borderColor: 'var(--border)',
        headerBackgroundColor: 'var(--muted)',
        headerTextColor: 'var(--foreground)',
        accentColor: 'var(--primary)',
        browserColorScheme: resolvedTheme === 'dark' ? 'dark' : 'light',
        headerFontSize: 13,
        fontFamily: 'var(--font-inter)',
      } as any),
    [resolvedTheme]
  )

  useEffect(() => {
    const api = gridApiRef.current
    if (!api) return

    const currentPageSize = api.paginationGetPageSize()
    if (currentPageSize !== pagination.pageSize) {
      api.setGridOption('paginationPageSize', pagination.pageSize)
    }

    const target = Math.max(0, pagination.page - 1)
    if (api.paginationGetCurrentPage() !== target) {
      api.paginationGoToPage(target)
    }
  }, [pagination.page, pagination.pageSize])

  const handleGridReady = (event: GridReadyEvent<T>) => {
    gridApiRef.current = event.api

    if (event.api.paginationGetPageSize() !== pagination.pageSize) {
      event.api.setGridOption('paginationPageSize', pagination.pageSize)
    }

    const target = Math.max(0, pagination.page - 1)
    if (event.api.paginationGetCurrentPage() !== target) {
      event.api.paginationGoToPage(target)
    }
  }

  const handlePaginationChanged = (event: PaginationChangedEvent<T>) => {
    if (!event.newPage && !event.newPageSize) return
    const api = event.api
    const next = {
      page: api.paginationGetCurrentPage() + 1,
      pageSize: api.paginationGetPageSize(),
    }

    if (
      next.page === pagination.page &&
      next.pageSize === pagination.pageSize
    ) {
      return
    }

    onPaginationChange(next)
  }

  const handleFilterChanged = (event: FilterChangedEvent<T>) => {
    onFilterChange(event.api.getFilterModel())
  }

  const handleSortChanged = (event: SortChangedEvent<T>) => {
    onSortChange(event.api.getColumnState())
  }

  return (
    <div className={cn('wms-grid h-[560px] w-full rounded-md', className)}>
      <div className='h-full w-full'>
        <AgGridReact<T>
          theme={theme}
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          loading={loading}
          pagination
          paginationPageSizeSelector={[10, 20, 50, 100]}
          animateRows
          suppressCellFocus
          rowSelection={{
            mode: 'singleRow',
          }}
          onGridReady={handleGridReady}
          onPaginationChanged={handlePaginationChanged}
          onFilterChanged={handleFilterChanged}
          onSortChanged={handleSortChanged}
          onRowClicked={(event) => {
            if (onRowClicked && event.data) {
              onRowClicked(event.data)
            }
          }}
        />
      </div>
    </div>
  )
}
