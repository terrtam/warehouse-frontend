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
import type { Customer, RecordStatus } from '@/domain/wms/types'
import { WmsPage } from '@/features/wms/components/wms-page'
import { GridToolbar } from '@/features/wms/components/grid-toolbar'
import { extractSortState, sortRows } from '@/features/wms/grid-utils'
import { statusOptions } from '@/features/wms/constants'

const route = getRouteApi('/_authenticated/customers/')

type CustomerFormState = {
  name: string
  email: string
  phone: string
  status: RecordStatus
}

type CustomerFormErrors = Partial<Record<keyof CustomerFormState, string>>

const initialFormState: CustomerFormState = {
  name: '',
  email: '',
  phone: '',
  status: 'active',
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function Customers() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const queryClient = useQueryClient()
  const authRoles = useAuthStore((state) => state.auth.user?.role)
  const parsedRoles = useMemo(() => getCurrentRoles(), [authRoles])
  const canManage = canAnyRole(parsedRoles, 'customers:manage')
  const { pagination, setPagination, q, setQuery, sortBy, sortDir, setSort } =
    useGridUrlState({
      search,
      navigate,
    })

  const [form, setForm] = useState<CustomerFormState>(initialFormState)
  const [formErrors, setFormErrors] = useState<CustomerFormErrors>({})
  const [formOpen, setFormOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)

  const customersQuery = useQuery({
    queryKey: wmsQueryKeys.customers,
    queryFn: () => wmsRepository.customers.list(),
  })

  const createMutation = useMutation({
    mutationFn: (payload: CustomerFormState) =>
      wmsRepository.customers.create(payload, getCurrentActor()),
    onSuccess: () => {
      toast.success('Customer created')
      setFormOpen(false)
      resetForm()
      queryClient.invalidateQueries({ queryKey: wmsQueryKeys.customers })
    },
    onError: handleWmsError,
  })

  const updateMutation = useMutation({
    mutationFn: (payload: {
      id: string
      customer: CustomerFormState
      version?: number
    }) =>
      wmsRepository.customers.update(
        payload.id,
        payload.customer,
        getCurrentActor(),
        payload.version
      ),
    onSuccess: () => {
      toast.success('Customer updated')
      if (formOpen) {
        setFormOpen(false)
        resetForm()
      }
      queryClient.invalidateQueries({ queryKey: wmsQueryKeys.customers })
    },
    onError: handleWmsError,
  })

  const resetForm = () => {
    setForm(initialFormState)
    setFormErrors({})
    setEditingCustomer(null)
  }

  const openCreateForm = () => {
    resetForm()
    setFormOpen(true)
  }

  const openEditForm = (row: Customer) => {
    setEditingCustomer(row)
    setForm({
      name: row.name,
      email: row.email,
      phone: row.phone,
      status: row.status,
    })
    setFormErrors({})
    setFormOpen(true)
  }

  const submitForm = () => {
    const nextErrors: CustomerFormErrors = {}
    if (!form.name.trim()) {
      nextErrors.name = 'Name is required'
    }
    if (!form.email.trim()) {
      nextErrors.email = 'Email is required'
    } else if (!emailPattern.test(form.email.trim())) {
      nextErrors.email = 'Please enter a valid email address'
    }
    if (!form.phone.trim()) {
      nextErrors.phone = 'Phone is required'
    }

    setFormErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const payload: CustomerFormState = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      status: form.status,
    }

    if (!editingCustomer) {
      createMutation.mutate(payload)
      return
    }

    updateMutation.mutate({
      id: editingCustomer.id,
      customer: payload,
      version: editingCustomer.version,
    })
  }

  const rows = useMemo(() => {
    const lowered = q.toLowerCase()
    const filtered = (customersQuery.data ?? []).filter((row) => {
      if (lowered.length === 0) return true
      return (
        row.name.toLowerCase().includes(lowered) ||
        row.email.toLowerCase().includes(lowered) ||
        row.phone.toLowerCase().includes(lowered)
      )
    })
    return sortRows(filtered, sortBy, sortDir)
  }, [customersQuery.data, q, sortBy, sortDir])

  const columns = useMemo<ColDef<Customer>[]>(
    () => [
      { field: 'name', headerName: 'Name' },
      { field: 'email', headerName: 'Email' },
      { field: 'phone', headerName: 'Phone', minWidth: 160 },
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
        cellRenderer: (params: { data?: Customer }) => {
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
                    customer: {
                      name: row.name,
                      email: row.email,
                      phone: row.phone,
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
      title='Customers'
      description='View, create, update, and sync customer data in real time.'
      actions={
        canManage ? (
          <Button onClick={openCreateForm} disabled={isSubmitting}>
            Add Customer
          </Button>
        ) : undefined
      }
    >
      {customersQuery.isError && (
        <Card>
          <CardContent className='flex items-center justify-between gap-2 py-4'>
            <p className='text-sm text-destructive'>Failed to load customers.</p>
            <Button
              variant='outline'
              size='sm'
              onClick={() => {
                customersQuery.refetch()
              }}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {customersQuery.isLoading && rows.length === 0 && (
        <Card>
          <CardContent className='py-4 text-sm text-muted-foreground'>
            Loading customers...
          </CardContent>
        </Card>
      )}

      <GridToolbar
        query={q}
        onQueryChange={setQuery}
        placeholder='Filter customers by name, email, or phone...'
      />

      <WmsGrid<Customer>
        rowData={rows}
        columnDefs={columns}
        loading={customersQuery.isLoading}
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
            <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
            <DialogDescription>
              Changes are synced with the backend and broadcast over realtime topics.
            </DialogDescription>
          </DialogHeader>

          <div className='grid gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='customer-name'>Name</Label>
              <Input
                id='customer-name'
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
              <Label htmlFor='customer-email'>Email</Label>
              <Input
                id='customer-email'
                type='email'
                value={form.email}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, email: event.target.value }))
                  setFormErrors((prev) => ({ ...prev, email: undefined }))
                }}
              />
              {formErrors.email && (
                <p className='text-xs text-destructive'>{formErrors.email}</p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='customer-phone'>Phone</Label>
              <Input
                id='customer-phone'
                value={form.phone}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, phone: event.target.value }))
                  setFormErrors((prev) => ({ ...prev, phone: undefined }))
                }}
              />
              {formErrors.phone && (
                <p className='text-xs text-destructive'>{formErrors.phone}</p>
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
              {editingCustomer ? 'Save Changes' : 'Create Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WmsPage>
  )
}
