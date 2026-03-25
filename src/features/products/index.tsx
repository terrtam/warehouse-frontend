import { useMemo, useState } from 'react'
import type { ColDef } from 'ag-grid-community'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { toast } from 'sonner'
import { canAnyRole } from '@/lib/auth/permissions'
import { getCurrentActor, getCurrentRoles, handleWmsError } from '@/lib/wms'
import { useGridUrlState } from '@/hooks/use-grid-url-state'
import { WmsGrid } from '@/components/ag-grid/wms-grid'
import { ConfirmDialog } from '@/components/confirm-dialog'
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
import type { Product } from '@/domain/wms/types'
import { WmsPage } from '@/features/wms/components/wms-page'
import { statusOptions } from '@/features/wms/constants'
import { GridToolbar } from '@/features/wms/components/grid-toolbar'
import { extractSortState, sortRows } from '@/features/wms/grid-utils'

const route = getRouteApi('/_authenticated/products/')

type ProductFormState = {
  name: string
  sku: string
  categoryId: string
  description: string
  unit: string
  defaultSalePrice: string
  costPrice: string
  reorderThreshold: string
  status: 'active' | 'inactive'
}

const initialFormState: ProductFormState = {
  name: '',
  sku: '',
  categoryId: '',
  description: '',
  unit: 'pcs',
  defaultSalePrice: '',
  costPrice: '',
  reorderThreshold: '',
  status: 'active',
}

type ProductFormErrors = Partial<Record<keyof ProductFormState, string>>

export function Products() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const queryClient = useQueryClient()
  const authRoles = useAuthStore((state) => state.auth.user?.role)
  const parsedRoles = useMemo(() => getCurrentRoles(), [authRoles])
  const canManage = canAnyRole(parsedRoles, 'products:manage')
  const { pagination, setPagination, q, setQuery, sortBy, sortDir, setSort } =
    useGridUrlState({
      search,
      navigate,
    })

  const [form, setForm] = useState<ProductFormState>(initialFormState)
  const [formErrors, setFormErrors] = useState<ProductFormErrors>({})
  const [formOpen, setFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null)

  const resetForm = () => {
    setForm(initialFormState)
    setFormErrors({})
    setEditingProduct(null)
  }

  const invalidateProducts = () => {
    queryClient.invalidateQueries({ queryKey: wmsQueryKeys.products })
  }

  const productsQuery = useQuery({
    queryKey: wmsQueryKeys.products,
    queryFn: () => wmsRepository.products.list(),
  })
  const categoriesQuery = useQuery({
    queryKey: wmsQueryKeys.categories,
    queryFn: () => wmsRepository.categories.list(),
  })

  const createMutation = useMutation({
    mutationFn: (payload: Product) =>
      wmsRepository.products.create(payload, getCurrentActor()),
    onSuccess: () => {
      toast.success('Product created')
      setFormOpen(false)
      resetForm()
      invalidateProducts()
    },
    onError: handleWmsError,
  })

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; product: Product }) =>
      wmsRepository.products.update(
        payload.id,
        payload.product,
        getCurrentActor(),
        payload.product.version
      ),
    onSuccess: () => {
      toast.success('Product updated')
      setFormOpen(false)
      resetForm()
      invalidateProducts()
    },
    onError: handleWmsError,
  })

  const deleteMutation = useMutation({
    mutationFn: (payload: { id: string; version: number }) =>
      wmsRepository.products.delete(
        payload.id,
        getCurrentActor(),
        payload.version
      ),
    onSuccess: () => {
      toast.success('Product deactivated')
      setPendingDelete(null)
      invalidateProducts()
    },
    onError: handleWmsError,
  })

  const openCreateForm = () => {
    resetForm()
    setFormOpen(true)
  }

  const openEditForm = (row: Product) => {
    setEditingProduct(row)
    setForm({
      name: row.name,
      sku: row.sku,
      categoryId: row.categoryId,
      description: row.description ?? '',
      unit: row.unit,
      defaultSalePrice: String(row.defaultSalePrice),
      costPrice: String(row.costPrice),
      reorderThreshold: String(row.reorderThreshold),
      status: row.status,
    })
    setFormErrors({})
    setFormOpen(true)
  }

  const submitForm = () => {
    const nextErrors: ProductFormErrors = {}
    const categoryOptions = categoriesQuery.data ?? []
    const validCategoryIds = new Set(categoryOptions.map((item) => item.id))

    if (!form.name.trim()) {
      nextErrors.name = 'Name is required'
    }

    if (!form.sku.trim()) {
      nextErrors.sku = 'SKU is required'
    }

    const duplicateSku = (productsQuery.data ?? []).some((item) => {
      const sameSku = item.sku.trim().toLowerCase() === form.sku.trim().toLowerCase()
      if (!sameSku) return false
      if (!editingProduct) return true
      return item.id !== editingProduct.id
    })
    if (duplicateSku) {
      nextErrors.sku = 'SKU must be unique'
    }

    if (!form.categoryId.trim()) {
      nextErrors.categoryId = 'Category is required'
    } else if (!validCategoryIds.has(form.categoryId.trim())) {
      nextErrors.categoryId = 'Please select a valid category'
    }

    if (!form.unit.trim()) {
      nextErrors.unit = 'Unit is required'
    }

    const parsedDefaultSalePrice = Number(form.defaultSalePrice)
    if (Number.isNaN(parsedDefaultSalePrice) || parsedDefaultSalePrice < 0) {
      nextErrors.defaultSalePrice = 'Default sale price must be 0 or greater'
    }

    const parsedCostPrice = Number(form.costPrice)
    if (Number.isNaN(parsedCostPrice) || parsedCostPrice < 0) {
      nextErrors.costPrice = 'Cost price must be 0 or greater'
    }

    const parsedReorderThreshold = Number(form.reorderThreshold)
    if (Number.isNaN(parsedReorderThreshold) || parsedReorderThreshold < 0) {
      nextErrors.reorderThreshold = 'Reorder threshold must be 0 or greater'
    }

    setFormErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) return

    if (editingProduct) {
      if (editingProduct.id.trim().length === 0) {
        toast.error('Cannot update product: invalid product id')
        return
      }

      const payload: Product = {
        id: editingProduct.id,
        name: form.name.trim(),
        sku: form.sku.trim(),
        categoryId: form.categoryId.trim(),
        categoryName:
          categoryOptions.find((item) => item.id === form.categoryId.trim())?.name ??
          editingProduct.categoryName,
        description: form.description.trim(),
        unit: form.unit.trim(),
        defaultSalePrice: parsedDefaultSalePrice,
        costPrice: parsedCostPrice,
        reorderThreshold: parsedReorderThreshold,
        status: form.status,
        version: editingProduct.version,
        createdAt: editingProduct.createdAt,
        updatedAt: editingProduct.updatedAt,
      }

      updateMutation.mutate({ id: editingProduct.id, product: payload })
      return
    }

    const payload: Product = {
      id: '',
      name: form.name.trim(),
      sku: form.sku.trim(),
      categoryId: form.categoryId.trim(),
      categoryName:
        categoryOptions.find((item) => item.id === form.categoryId.trim())?.name ?? '',
      description: form.description.trim(),
      unit: form.unit.trim(),
      defaultSalePrice: parsedDefaultSalePrice,
      costPrice: parsedCostPrice,
      reorderThreshold: parsedReorderThreshold,
      status: form.status,
      version: 1,
      createdAt: '',
      updatedAt: '',
    }

    createMutation.mutate(payload)
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  const rows = useMemo(() => {
    const lowered = q.toLowerCase()
    const filtered = (productsQuery.data ?? []).filter((row) => {
      if (lowered.length === 0) return true
      return (
        row.name.toLowerCase().includes(lowered) ||
        row.sku.toLowerCase().includes(lowered) ||
        row.categoryName.toLowerCase().includes(lowered) ||
        (row.description ?? '').toLowerCase().includes(lowered) ||
        row.unit.toLowerCase().includes(lowered) ||
        row.defaultSalePrice.toString().includes(lowered) ||
        row.costPrice.toString().includes(lowered) ||
        row.reorderThreshold.toString().includes(lowered) ||
        row.status.toLowerCase().includes(lowered)
      )
    })
    return sortRows(filtered, sortBy, sortDir)
  }, [productsQuery.data, q, sortBy, sortDir])

  const columns = useMemo<ColDef<Product>[]>(
    () => [
      { field: 'name', headerName: 'Name' },
      { field: 'sku', headerName: 'SKU', minWidth: 140 },
      { field: 'categoryName', headerName: 'Category', minWidth: 180 },
      { field: 'description', headerName: 'Description', minWidth: 220 },
      { field: 'unit', headerName: 'Unit', minWidth: 110 },
      {
        field: 'defaultSalePrice',
        headerName: 'Default Sale Price',
        valueFormatter: ({ value }) =>
          typeof value === 'number' ? `$${value.toFixed(2)}` : '',
      },
      {
        field: 'costPrice',
        headerName: 'Cost Price',
        valueFormatter: ({ value }) =>
          typeof value === 'number' ? `$${value.toFixed(2)}` : '',
      },
      { field: 'reorderThreshold', headerName: 'Reorder Threshold', minWidth: 160 },
      { field: 'status', headerName: 'Status', minWidth: 130 },
      {
        colId: 'actions',
        headerName: 'Actions',
        sortable: false,
        filter: false,
        minWidth: 220,
        cellRenderer: (params: { data?: Product }) => {
          const row = params.data
          if (!row || !canManage) return null
          return (
            <div className='flex items-center gap-2'>
              <Button size='sm' variant='outline' onClick={() => openEditForm(row)}>
                Edit
              </Button>
              <Button
                size='sm'
                variant='outline'
                onClick={() => {
                  setPendingDelete(row)
                }}
              >
                Deactivate
              </Button>
            </div>
          )
        },
      },
    ],
    [canManage]
  )

  return (
    <WmsPage
      title='Products'
      description='Manage product catalog and pricing.'
      actions={
        canManage ? (
          <Button onClick={openCreateForm} disabled={isSubmitting}>
            Add Product
          </Button>
        ) : undefined
      }
    >
      {productsQuery.isError && (
        <Card>
          <CardContent className='flex items-center justify-between gap-2 py-4'>
            <p className='text-sm text-destructive'>Failed to load products.</p>
            <Button
              variant='outline'
              size='sm'
              onClick={() => {
                productsQuery.refetch()
              }}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {productsQuery.isLoading && rows.length === 0 && (
        <Card>
          <CardContent className='py-4 text-sm text-muted-foreground'>
            Loading products...
          </CardContent>
        </Card>
      )}

      <GridToolbar
        query={q}
        onQueryChange={setQuery}
        placeholder='Filter products by name, SKU, category, unit, prices, threshold, or status...'
      />

      <WmsGrid<Product>
        rowData={rows}
        columnDefs={columns}
        loading={productsQuery.isLoading}
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
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Add Product'}</DialogTitle>
            <DialogDescription>
              Enter product details and save to sync with the backend.
            </DialogDescription>
          </DialogHeader>

          <div className='grid gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='product-name'>Name</Label>
              <Input
                id='product-name'
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
              <Label htmlFor='product-sku'>SKU</Label>
              <Input
                id='product-sku'
                value={form.sku}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, sku: event.target.value }))
                  setFormErrors((prev) => ({ ...prev, sku: undefined }))
                }}
              />
              {formErrors.sku && (
                <p className='text-xs text-destructive'>{formErrors.sku}</p>
              )}
            </div>

            <div className='space-y-2'>
              <Label>Category</Label>
              <Select
                value={form.categoryId}
                onValueChange={(value) => {
                  setForm((prev) => ({ ...prev, categoryId: value }))
                  setFormErrors((prev) => ({ ...prev, categoryId: undefined }))
                }}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='Select category' />
                </SelectTrigger>
                <SelectContent>
                  {(categoriesQuery.data ?? []).map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.categoryId && (
                <p className='text-xs text-destructive'>{formErrors.categoryId}</p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='product-description'>Description</Label>
              <Input
                id='product-description'
                value={form.description}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, description: event.target.value }))
                }}
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='product-unit'>Unit</Label>
              <Input
                id='product-unit'
                value={form.unit}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, unit: event.target.value }))
                  setFormErrors((prev) => ({ ...prev, unit: undefined }))
                }}
              />
              {formErrors.unit && (
                <p className='text-xs text-destructive'>{formErrors.unit}</p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='product-default-sale-price'>Default Sale Price</Label>
              <Input
                id='product-default-sale-price'
                type='number'
                min='0'
                step='0.01'
                value={form.defaultSalePrice}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, defaultSalePrice: event.target.value }))
                  setFormErrors((prev) => ({
                    ...prev,
                    defaultSalePrice: undefined,
                  }))
                }}
              />
              {formErrors.defaultSalePrice && (
                <p className='text-xs text-destructive'>{formErrors.defaultSalePrice}</p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='product-cost-price'>Cost Price</Label>
              <Input
                id='product-cost-price'
                type='number'
                min='0'
                step='0.01'
                value={form.costPrice}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, costPrice: event.target.value }))
                  setFormErrors((prev) => ({ ...prev, costPrice: undefined }))
                }}
              />
              {formErrors.costPrice && (
                <p className='text-xs text-destructive'>{formErrors.costPrice}</p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='product-reorder-threshold'>Reorder Threshold</Label>
              <Input
                id='product-reorder-threshold'
                type='number'
                min='0'
                step='1'
                value={form.reorderThreshold}
                onChange={(event) => {
                  setForm((prev) => ({
                    ...prev,
                    reorderThreshold: event.target.value,
                  }))
                  setFormErrors((prev) => ({ ...prev, reorderThreshold: undefined }))
                }}
              />
              {formErrors.reorderThreshold && (
                <p className='text-xs text-destructive'>{formErrors.reorderThreshold}</p>
              )}
            </div>

            <div className='space-y-2'>
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) => {
                  setForm((prev) => ({
                    ...prev,
                    status: value as ProductFormState['status'],
                  }))
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
              {formErrors.status && (
                <p className='text-xs text-destructive'>{formErrors.status}</p>
              )}
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
              {editingProduct ? 'Save Changes' : 'Create Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title='Deactivate Product'
        desc={
          pendingDelete
            ? `Are you sure you want to deactivate "${pendingDelete.name}"?`
            : 'Are you sure you want to deactivate this product?'
        }
        confirmText='Deactivate'
        isLoading={deleteMutation.isPending}
        handleConfirm={() => {
          if (!pendingDelete) return
          if (pendingDelete.id.trim().length === 0) {
            toast.error('Cannot deactivate product: invalid product id')
            setPendingDelete(null)
            return
          }

          deleteMutation.mutate({
            id: pendingDelete.id,
            version: pendingDelete.version,
          })
        }}
      />
    </WmsPage>
  )
}
