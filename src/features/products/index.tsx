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
import type { Product, RecordStatus } from '@/domain/wms/types'
import { WmsPage } from '@/features/wms/components/wms-page'
import { GridToolbar } from '@/features/wms/components/grid-toolbar'
import { extractSortState, sortRows } from '@/features/wms/grid-utils'
import { statusOptions } from '@/features/wms/constants'

const route = getRouteApi('/_authenticated/products/')

type ProductFormState = {
  name: string
  sku: string
  categoryId: string
  unit: string
  defaultSalePrice: string
  costPrice: string
  reorderThreshold: string
  status: RecordStatus
}

const initialFormState: ProductFormState = {
  name: '',
  sku: '',
  categoryId: '',
  unit: 'pcs',
  defaultSalePrice: '',
  costPrice: '',
  reorderThreshold: '',
  status: 'active',
}

export function Products() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const queryClient = useQueryClient()
  const authRoles = useAuthStore((state) => state.auth.user?.role ?? [])
  const parsedRoles = useMemo(() => getCurrentRoles(), [authRoles])
  const canManage = canAnyRole(parsedRoles, 'products:manage')
  const { pagination, setPagination, q, setQuery, sortBy, sortDir, setSort } =
    useGridUrlState({
      search,
      navigate,
    })

  const [form, setForm] = useState<ProductFormState>(initialFormState)

  const productsQuery = useQuery({
    queryKey: wmsQueryKeys.products,
    queryFn: () => wmsRepository.products.list(),
  })

  const categoriesQuery = useQuery({
    queryKey: wmsQueryKeys.categories,
    queryFn: () => wmsRepository.categories.list(),
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.categoryId) {
        throw new Error('Category is required')
      }
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim(),
        categoryId: form.categoryId,
        unit: form.unit.trim(),
        defaultSalePrice: Number(form.defaultSalePrice),
        costPrice: Number(form.costPrice),
        reorderThreshold: Number(form.reorderThreshold),
        status: form.status,
      }
      return wmsRepository.products.create(payload, getCurrentActor())
    },
    onSuccess: () => {
      toast.success('Product created')
      setForm(initialFormState)
      queryClient.invalidateQueries({ queryKey: wmsQueryKeys.products })
      queryClient.invalidateQueries({ queryKey: wmsQueryKeys.inventory })
    },
    onError: handleWmsError,
  })

  const updateMutation = useMutation({
    mutationFn: (row: Product) =>
      wmsRepository.products.update(
        row.id,
        {
          name: row.name,
          sku: row.sku,
          categoryId: row.categoryId,
          unit: row.unit,
          defaultSalePrice: row.defaultSalePrice,
          costPrice: row.costPrice,
          reorderThreshold: row.reorderThreshold,
          status: row.status === 'active' ? 'inactive' : 'active',
        },
        getCurrentActor(),
        row.version
      ),
    onSuccess: () => {
      toast.success('Product updated')
      queryClient.invalidateQueries({ queryKey: wmsQueryKeys.products })
      queryClient.invalidateQueries({ queryKey: wmsQueryKeys.inventory })
    },
    onError: handleWmsError,
  })

  const rows = useMemo(() => {
    const lowered = q.toLowerCase()
    const filtered = (productsQuery.data ?? []).filter((row) => {
      if (lowered.length === 0) return true
      return (
        row.name.toLowerCase().includes(lowered) ||
        row.sku.toLowerCase().includes(lowered) ||
        row.categoryName.toLowerCase().includes(lowered)
      )
    })
    return sortRows(filtered, sortBy, sortDir)
  }, [productsQuery.data, q, sortBy, sortDir])

  const columns = useMemo<ColDef<Product>[]>(
    () => [
      { field: 'name', headerName: 'Name' },
      { field: 'sku', headerName: 'SKU' },
      { field: 'categoryName', headerName: 'Category' },
      { field: 'unit', headerName: 'Unit', maxWidth: 110 },
      {
        field: 'defaultSalePrice',
        headerName: 'Sale Price',
        valueFormatter: ({ value }) =>
          typeof value === 'number' ? `$${value.toFixed(2)}` : '',
      },
      {
        field: 'costPrice',
        headerName: 'Cost',
        valueFormatter: ({ value }) =>
          typeof value === 'number' ? `$${value.toFixed(2)}` : '',
      },
      { field: 'reorderThreshold', headerName: 'Reorder', maxWidth: 120 },
      { field: 'status', headerName: 'Status', maxWidth: 120 },
      {
        colId: 'actions',
        headerName: 'Actions',
        sortable: false,
        filter: false,
        minWidth: 140,
        cellRenderer: (params: { data?: Product }) => {
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

  const categoryOptions = categoriesQuery.data ?? []

  const createDisabled =
    createMutation.isPending ||
    !form.name.trim() ||
    !form.sku.trim() ||
    !form.categoryId ||
    Number.isNaN(Number(form.defaultSalePrice)) ||
    Number.isNaN(Number(form.costPrice)) ||
    Number.isNaN(Number(form.reorderThreshold))

  return (
    <WmsPage
      title='Products'
      description='Manage SKU catalog, pricing, and reorder thresholds.'
    >
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Create Product</CardTitle>
          </CardHeader>
          <CardContent className='grid gap-4 md:grid-cols-4'>
            <div className='space-y-2'>
              <Label htmlFor='product-name'>Name</Label>
              <Input
                id='product-name'
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder='Wireless Scanner'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='product-sku'>SKU</Label>
              <Input
                id='product-sku'
                value={form.sku}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, sku: event.target.value }))
                }
                placeholder='WH-1001'
              />
            </div>
            <div className='space-y-2'>
              <Label>Category</Label>
              <Select
                value={form.categoryId}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, categoryId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder='Select category' />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='product-unit'>Unit</Label>
              <Input
                id='product-unit'
                value={form.unit}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, unit: event.target.value }))
                }
                placeholder='pcs'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='product-sale-price'>Default Sale Price</Label>
              <Input
                id='product-sale-price'
                type='number'
                min='0'
                step='0.01'
                value={form.defaultSalePrice}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    defaultSalePrice: event.target.value,
                  }))
                }
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='product-cost-price'>Cost Price</Label>
              <Input
                id='product-cost-price'
                type='number'
                min='0'
                step='0.01'
                value={form.costPrice}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, costPrice: event.target.value }))
                }
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='product-reorder'>Reorder Threshold</Label>
              <Input
                id='product-reorder'
                type='number'
                min='0'
                value={form.reorderThreshold}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    reorderThreshold: event.target.value,
                  }))
                }
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
                Create Product
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <GridToolbar
        query={q}
        onQueryChange={setQuery}
        placeholder='Filter products by name, SKU, or category...'
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
    </WmsPage>
  )
}
