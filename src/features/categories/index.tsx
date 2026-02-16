import { useMemo, useState } from 'react'
import type { ColDef } from 'ag-grid-community'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { toast } from 'sonner'
import { canAnyRole } from '@/lib/auth/permissions'
import { getCurrentActor, getCurrentRoles, handleWmsError } from '@/lib/wms'
import { useGridUrlState } from '@/hooks/use-grid-url-state'
import { WmsGrid } from '@/components/ag-grid/wms-grid'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuthStore } from '@/stores/auth-store'
import { wmsQueryKeys, wmsRepository } from '@/services/wms'
import type { Category, RecordStatus } from '@/domain/wms/types'
import { WmsPage } from '@/features/wms/components/wms-page'
import { GridToolbar } from '@/features/wms/components/grid-toolbar'
import { extractSortState, sortRows } from '@/features/wms/grid-utils'
import { statusOptions } from '@/features/wms/constants'

const route = getRouteApi('/_authenticated/categories/')

export function Categories() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const queryClient = useQueryClient()
  const authRoles = useAuthStore((state) => state.auth.user?.role)
  const parsedRoles = useMemo(() => getCurrentRoles(), [authRoles])
  const canManage = canAnyRole(parsedRoles, 'categories:manage')
  const { pagination, setPagination, q, setQuery, sortBy, sortDir, setSort } = useGridUrlState({
    search,
    navigate,
  })

  const [name, setName] = useState('')
  const [status, setStatus] = useState<RecordStatus>('active')

  const categoriesQuery = useQuery({
    queryKey: wmsQueryKeys.categories,
    queryFn: () => wmsRepository.categories.list(),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      wmsRepository.categories.create(
        {
          name,
          status,
        },
        getCurrentActor()
      ),
    onSuccess: () => {
      toast.success('Category created')
      setName('')
      setStatus('active')
      queryClient.invalidateQueries({ queryKey: wmsQueryKeys.categories })
    },
    onError: handleWmsError,
  })

  const updateMutation = useMutation({
    mutationFn: (row: Category) =>
      wmsRepository.categories.update(
        row.id,
        {
          name: row.name,
          status: row.status === 'active' ? 'inactive' : 'active',
        },
        getCurrentActor(),
        row.version
      ),
    onSuccess: () => {
      toast.success('Category updated')
      queryClient.invalidateQueries({ queryKey: wmsQueryKeys.categories })
    },
    onError: handleWmsError,
  })

  const filteredRows = useMemo(() => {
    const rows = categoriesQuery.data ?? []
    const lowered = q.toLowerCase()
    const bySearch = rows.filter(
      (row) => lowered.length === 0 || row.name.toLowerCase().includes(lowered)
    )
    return sortRows(bySearch, sortBy, sortDir)
  }, [categoriesQuery.data, q, sortBy, sortDir])

  const columns = useMemo<ColDef<Category>[]>(
    () => [
      { field: 'name', headerName: 'Name' },
      { field: 'status', headerName: 'Status' },
      { field: 'version', headerName: 'Version', maxWidth: 120 },
      {
        field: 'updatedAt',
        headerName: 'Updated',
        valueFormatter: ({ value }) =>
          typeof value === 'string' ? new Date(value).toLocaleString() : '',
      },
      {
        colId: 'actions',
        headerName: 'Actions',
        sortable: false,
        filter: false,
        cellRenderer: (params: { data?: Category }) => {
          const row = params.data
          if (!row || !canManage) return null
          return (
            <Button
              size='sm'
              variant='outline'
              onClick={() => {
                updateMutation.mutate(row)
              }}
            >
              {row.status === 'active' ? 'Deactivate' : 'Activate'}
            </Button>
          )
        },
      },
    ],
    [canManage, updateMutation]
  )

  return (
    <WmsPage
      title='Categories'
      description='Create and maintain product categories.'
      actions={null}
    >
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Create Category</CardTitle>
          </CardHeader>
          <CardContent className='grid gap-4 sm:grid-cols-3'>
            <div className='space-y-2'>
              <Label htmlFor='category-name'>Name</Label>
              <Input
                id='category-name'
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder='Category name'
              />
            </div>
            <div className='space-y-2'>
              <Label>Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as RecordStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder='Select status' />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='flex items-end'>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || name.trim().length === 0}
              >
                Create Category
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <GridToolbar
        query={q}
        onQueryChange={setQuery}
        placeholder='Filter categories by name...'
      />

      <WmsGrid<Category>
        rowData={filteredRows}
        columnDefs={columns}
        loading={categoriesQuery.isLoading}
        pagination={pagination}
        onPaginationChange={setPagination}
        onFilterChange={() => {
          // This screen uses URL-backed text search and keeps column filter model local.
        }}
        onSortChange={(model) => {
          const next = extractSortState(model)
          setSort(next.sortBy, next.sortDir)
        }}
      />
    </WmsPage>
  )
}
