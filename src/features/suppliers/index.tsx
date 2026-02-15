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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuthStore } from '@/stores/auth-store'
import { wmsQueryKeys, wmsRepository } from '@/services/wms'
import type { RecordStatus, Supplier } from '@/domain/wms/types'
import { WmsPage } from '@/features/wms/components/wms-page'
import { GridToolbar } from '@/features/wms/components/grid-toolbar'
import { extractSortState, sortRows } from '@/features/wms/grid-utils'
import { statusOptions } from '@/features/wms/constants'

const route = getRouteApi('/_authenticated/suppliers/')

type SupplierFormState = {
  name: string
  contactInfo: string
  address: string
  status: RecordStatus
}

const initialFormState: SupplierFormState = {
  name: '',
  contactInfo: '',
  address: '',
  status: 'active',
}

export function Suppliers() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const queryClient = useQueryClient()
  const authRoles = useAuthStore((state) => state.auth.user?.role ?? [])
  const parsedRoles = useMemo(() => getCurrentRoles(), [authRoles])
  const canManage = canAnyRole(parsedRoles, 'suppliers:manage')
  const { pagination, setPagination, q, setQuery, sortBy, sortDir, setSort } =
    useGridUrlState({
      search,
      navigate,
    })

  const [form, setForm] = useState<SupplierFormState>(initialFormState)

  const suppliersQuery = useQuery({
    queryKey: wmsQueryKeys.suppliers,
    queryFn: () => wmsRepository.suppliers.list(),
  })

  const createMutation = useMutation({
    mutationFn: () => wmsRepository.suppliers.create(form, getCurrentActor()),
    onSuccess: () => {
      toast.success('Supplier created')
      setForm(initialFormState)
      queryClient.invalidateQueries({ queryKey: wmsQueryKeys.suppliers })
    },
    onError: handleWmsError,
  })

  const updateMutation = useMutation({
    mutationFn: (row: Supplier) =>
      wmsRepository.suppliers.update(
        row.id,
        {
          name: row.name,
          contactInfo: row.contactInfo,
          address: row.address,
          status: row.status === 'active' ? 'inactive' : 'active',
        },
        getCurrentActor(),
        row.version
      ),
    onSuccess: () => {
      toast.success('Supplier updated')
      queryClient.invalidateQueries({ queryKey: wmsQueryKeys.suppliers })
    },
    onError: handleWmsError,
  })

  const rows = useMemo(() => {
    const lowered = q.toLowerCase()
    const filtered = (suppliersQuery.data ?? []).filter((row) => {
      if (lowered.length === 0) return true
      return (
        row.name.toLowerCase().includes(lowered) ||
        row.contactInfo.toLowerCase().includes(lowered) ||
        row.address.toLowerCase().includes(lowered)
      )
    })
    return sortRows(filtered, sortBy, sortDir)
  }, [suppliersQuery.data, q, sortBy, sortDir])

  const columns = useMemo<ColDef<Supplier>[]>(
    () => [
      { field: 'name', headerName: 'Name' },
      { field: 'contactInfo', headerName: 'Contact' },
      { field: 'address', headerName: 'Address' },
      { field: 'status', headerName: 'Status', maxWidth: 120 },
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
        minWidth: 140,
        cellRenderer: (params: { data?: Supplier }) => {
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

  const createDisabled =
    createMutation.isPending ||
    !form.name.trim() ||
    !form.contactInfo.trim() ||
    !form.address.trim()

  return (
    <WmsPage
      title='Suppliers'
      description='Maintain supplier records used by purchase orders.'
    >
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Create Supplier</CardTitle>
          </CardHeader>
          <CardContent className='grid gap-4 md:grid-cols-4'>
            <div className='space-y-2'>
              <Label htmlFor='supplier-name'>Name</Label>
              <Input
                id='supplier-name'
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder='Apex Supply Co.'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='supplier-contact'>Contact Info</Label>
              <Input
                id='supplier-contact'
                value={form.contactInfo}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, contactInfo: event.target.value }))
                }
                placeholder='sales@apex.example'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='supplier-address'>Address</Label>
              <Input
                id='supplier-address'
                value={form.address}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, address: event.target.value }))
                }
                placeholder='9 Industrial Rd, Denver, CO'
              />
            </div>
            <div className='space-y-2'>
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, status: value as RecordStatus }))
                }
              >
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
            <div className='md:col-span-4 flex justify-end'>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createDisabled}
              >
                Create Supplier
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <GridToolbar
        query={q}
        onQueryChange={setQuery}
        placeholder='Filter suppliers...'
      />

      <WmsGrid<Supplier>
        rowData={rows}
        columnDefs={columns}
        loading={suppliersQuery.isLoading}
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
