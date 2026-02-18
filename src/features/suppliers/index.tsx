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
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  email: string
  phone: string
  address: string
  status: RecordStatus
}

type SupplierFormErrors = Partial<
  Record<keyof SupplierFormState | 'contact', string>
>

const initialFormState: SupplierFormState = {
  name: '',
  email: '',
  phone: '',
  address: '',
  status: 'active',
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function Suppliers() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const queryClient = useQueryClient()
  const authRoles = useAuthStore((state) => state.auth.user?.role)
  const parsedRoles = useMemo(() => getCurrentRoles(), [authRoles])
  const canManage = canAnyRole(parsedRoles, 'suppliers:manage')
  const { pagination, setPagination, q, setQuery, sortBy, sortDir, setSort } =
    useGridUrlState({
      search,
      navigate,
    })

  const [form, setForm] = useState<SupplierFormState>(initialFormState)
  const [formErrors, setFormErrors] = useState<SupplierFormErrors>({})
  const [formOpen, setFormOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)

  const suppliersQuery = useQuery({
    queryKey: wmsQueryKeys.suppliers,
    queryFn: () => wmsRepository.suppliers.list(),
  })

  const createMutation = useMutation({
    mutationFn: (payload: SupplierFormState) =>
      wmsRepository.suppliers.create(payload, getCurrentActor()),
    onSuccess: () => {
      toast.success('Supplier created')
      setFormOpen(false)
      resetForm()
      queryClient.invalidateQueries({ queryKey: wmsQueryKeys.suppliers })
    },
    onError: handleWmsError,
  })

  const updateMutation = useMutation({
    mutationFn: (payload: {
      id: string
      supplier: SupplierFormState
      version?: number
    }) =>
      wmsRepository.suppliers.update(
        payload.id,
        payload.supplier,
        getCurrentActor(),
        payload.version
      ),
    onSuccess: () => {
      toast.success('Supplier updated')
      if (formOpen) {
        setFormOpen(false)
        resetForm()
      }
      queryClient.invalidateQueries({ queryKey: wmsQueryKeys.suppliers })
    },
    onError: handleWmsError,
  })

  const resetForm = () => {
    setForm(initialFormState)
    setFormErrors({})
    setEditingSupplier(null)
  }

  const openCreateForm = () => {
    resetForm()
    setFormOpen(true)
  }

  const openEditForm = (row: Supplier) => {
    setEditingSupplier(row)
    setForm({
      name: row.name,
      email: row.email,
      phone: row.phone,
      address: row.address,
      status: row.status,
    })
    setFormErrors({})
    setFormOpen(true)
  }

  const submitForm = () => {
    const nextErrors: SupplierFormErrors = {}
    if (!form.name.trim()) {
      nextErrors.name = 'Name is required'
    }
    if (!form.email.trim() && !form.phone.trim()) {
      nextErrors.contact = 'Provide at least one contact method'
    }
    if (form.email.trim() && !emailPattern.test(form.email.trim())) {
      nextErrors.email = 'Please enter a valid email address'
    }
    if (!form.address.trim()) {
      nextErrors.address = 'Address is required'
    }

    setFormErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const payload: SupplierFormState = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      status: form.status,
    }

    if (!editingSupplier) {
      createMutation.mutate(payload)
      return
    }

    updateMutation.mutate({
      id: editingSupplier.id,
      supplier: payload,
      version: editingSupplier.version,
    })
  }

  const rows = useMemo(() => {
    const lowered = q.toLowerCase()
    const filtered = (suppliersQuery.data ?? []).filter((row) => {
      if (lowered.length === 0) return true
      return (
        row.name.toLowerCase().includes(lowered) ||
        row.email.toLowerCase().includes(lowered) ||
        row.phone.toLowerCase().includes(lowered) ||
        row.address.toLowerCase().includes(lowered)
      )
    })
    return sortRows(filtered, sortBy, sortDir)
  }, [suppliersQuery.data, q, sortBy, sortDir])

  const columns = useMemo<ColDef<Supplier>[]>(
    () => [
      { field: 'name', headerName: 'Name' },
      { field: 'email', headerName: 'Email' },
      { field: 'phone', headerName: 'Phone', minWidth: 160 },
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
        minWidth: 220,
        cellRenderer: (params: { data?: Supplier }) => {
          const row = params.data
          if (!row || !canManage) return null
          return (
            <div className='flex gap-2'>
              <Button size='sm' variant='outline' onClick={() => openEditForm(row)}>
                Edit
              </Button>
              <Button
                size='sm'
                variant='outline'
                onClick={() => {
                  updateMutation.mutate({
                    id: row.id,
                    supplier: {
                      name: row.name,
                      email: row.email,
                      phone: row.phone,
                      address: row.address,
                      status: row.status === 'active' ? 'inactive' : 'active',
                    },
                    version: row.version,
                  })
                }}
              >
                {row.status === 'active' ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          )
        },
      },
    ],
    [canManage, openEditForm, updateMutation]
  )

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  return (
    <WmsPage
      title='Suppliers'
      description='View, create, update, and sync supplier data in real time.'
      actions={
        canManage ? (
          <Button onClick={openCreateForm} disabled={isSubmitting}>
            Add Supplier
          </Button>
        ) : undefined
      }
    >
      {suppliersQuery.isError && (
        <Card>
          <CardContent className='flex items-center justify-between gap-2 py-4'>
            <p className='text-sm text-destructive'>Failed to load suppliers.</p>
            <Button
              variant='outline'
              size='sm'
              onClick={() => {
                suppliersQuery.refetch()
              }}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {suppliersQuery.isLoading && rows.length === 0 && (
        <Card>
          <CardContent className='py-4 text-sm text-muted-foreground'>
            Loading suppliers...
          </CardContent>
        </Card>
      )}

      <GridToolbar
        query={q}
        onQueryChange={setQuery}
        placeholder='Filter suppliers by name, email, phone, or address...'
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

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) {
            resetForm()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSupplier ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
            <DialogDescription>
              Changes are synced with the backend and broadcast over realtime topics.
            </DialogDescription>
          </DialogHeader>

          <div className='grid gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='supplier-name'>Name</Label>
              <Input
                id='supplier-name'
                value={form.name}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                  setFormErrors((prev) => ({ ...prev, name: undefined }))
                }}
              />
              {formErrors.name && (
                <p className='text-xs text-destructive'>{formErrors.name}</p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='supplier-email'>Email</Label>
              <Input
                id='supplier-email'
                type='email'
                value={form.email}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, email: event.target.value }))
                  setFormErrors((prev) => ({
                    ...prev,
                    email: undefined,
                    contact: undefined,
                  }))
                }}
              />
              {formErrors.email && (
                <p className='text-xs text-destructive'>{formErrors.email}</p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='supplier-phone'>Phone</Label>
              <Input
                id='supplier-phone'
                value={form.phone}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, phone: event.target.value }))
                  setFormErrors((prev) => ({ ...prev, contact: undefined }))
                }}
              />
            </div>

            {formErrors.contact && (
              <p className='text-xs text-destructive'>{formErrors.contact}</p>
            )}

            <div className='space-y-2'>
              <Label htmlFor='supplier-address'>Address</Label>
              <Input
                id='supplier-address'
                value={form.address}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, address: event.target.value }))
                  setFormErrors((prev) => ({ ...prev, address: undefined }))
                }}
              />
              {formErrors.address && (
                <p className='text-xs text-destructive'>{formErrors.address}</p>
              )}
            </div>

            <div className='space-y-2'>
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) => {
                  setForm((prev) => ({ ...prev, status: value as RecordStatus }))
                }}
              >
                <SelectTrigger className='w-full'>
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
          </div>

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => {
                setFormOpen(false)
                resetForm()
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={submitForm} disabled={isSubmitting}>
              {editingSupplier ? 'Save Changes' : 'Create Supplier'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WmsPage>
  )
}
