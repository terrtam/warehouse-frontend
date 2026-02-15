import { useMemo, useState } from 'react'
import type { ColDef } from 'ag-grid-community'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { canAnyRole } from '@/lib/auth/permissions'
import { getCurrentActor, getCurrentRoles, handleWmsError } from '@/lib/wms'
import { useGridUrlState } from '@/hooks/use-grid-url-state'
import { WmsGrid } from '@/components/ag-grid/wms-grid'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
import type { InventoryRecord } from '@/domain/wms/types'
import { WmsPage } from '@/features/wms/components/wms-page'
import { GridToolbar } from '@/features/wms/components/grid-toolbar'
import { extractSortState, sortRows } from '@/features/wms/grid-utils'

const route = getRouteApi('/_authenticated/inventory/')

type AdjustmentState = {
  productId: string
  quantityDelta: string
  reason: string
  allowNegativeOverride: boolean
}

const initialAdjustmentState: AdjustmentState = {
  productId: '',
  quantityDelta: '',
  reason: '',
  allowNegativeOverride: false,
}

export function Inventory() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const queryClient = useQueryClient()
  const authRoles = useAuthStore((state) => state.auth.user?.role ?? [])
  const parsedRoles = useMemo(() => getCurrentRoles(), [authRoles])
  const canAdjust = canAnyRole(parsedRoles, 'inventory:adjust')
  const canOverride = canAnyRole(parsedRoles, 'inventory:override-negative')
  const { pagination, setPagination, q, setQuery, sortBy, sortDir, setSort } =
    useGridUrlState({
      search,
      navigate,
    })

  const [adjustment, setAdjustment] = useState<AdjustmentState>(
    initialAdjustmentState
  )

  const inventoryQuery = useQuery({
    queryKey: wmsQueryKeys.inventory,
    queryFn: () => wmsRepository.inventory.list(),
  })

  const productsQuery = useQuery({
    queryKey: wmsQueryKeys.products,
    queryFn: () => wmsRepository.products.list(),
  })

  const adjustMutation = useMutation({
    mutationFn: () =>
      wmsRepository.inventory.adjust(
        {
          productId: adjustment.productId,
          quantityDelta: Number(adjustment.quantityDelta),
          reason: adjustment.reason,
          allowNegativeOverride: adjustment.allowNegativeOverride,
        },
        getCurrentActor()
      ),
    onSuccess: () => {
      setAdjustment(initialAdjustmentState)
      queryClient.invalidateQueries({ queryKey: wmsQueryKeys.inventory })
      queryClient.invalidateQueries({
        queryKey: wmsQueryKeys.inventoryTransactions,
      })
    },
    onError: handleWmsError,
  })

  const rows = useMemo(() => {
    const lowered = q.toLowerCase()
    const filtered = (inventoryQuery.data ?? []).filter((row) => {
      if (lowered.length === 0) return true
      return (
        row.productName.toLowerCase().includes(lowered) ||
        row.sku.toLowerCase().includes(lowered)
      )
    })
    return sortRows(filtered, sortBy, sortDir)
  }, [inventoryQuery.data, q, sortBy, sortDir])

  const columns = useMemo<ColDef<InventoryRecord>[]>(
    () => [
      { field: 'productName', headerName: 'Product' },
      { field: 'sku', headerName: 'SKU', maxWidth: 140 },
      { field: 'currentQuantity', headerName: 'Current Qty', maxWidth: 140 },
      { field: 'reorderThreshold', headerName: 'Reorder Threshold', maxWidth: 170 },
      {
        field: 'lowStock',
        headerName: 'Low Stock',
        maxWidth: 120,
        valueFormatter: ({ value }) => (value ? 'Yes' : 'No'),
      },
    ],
    []
  )

  const adjustmentDisabled =
    adjustMutation.isPending ||
    !adjustment.productId ||
    Number.isNaN(Number(adjustment.quantityDelta)) ||
    Number(adjustment.quantityDelta) === 0 ||
    !adjustment.reason.trim()

  const activeProducts = (productsQuery.data ?? []).filter(
    (item) => item.status === 'active'
  )

  return (
    <WmsPage
      title='Inventory'
      description='Current stock levels are derived from inventory transactions.'
    >
      {canAdjust && (
        <Card>
          <CardHeader>
            <CardTitle>Create Adjustment</CardTitle>
          </CardHeader>
          <CardContent className='grid gap-4 md:grid-cols-4'>
            <div className='space-y-2'>
              <Label>Product</Label>
              <Select
                value={adjustment.productId}
                onValueChange={(value) =>
                  setAdjustment((prev) => ({ ...prev, productId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder='Select product' />
                </SelectTrigger>
                <SelectContent>
                  {activeProducts.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} ({item.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='adjustment-qty'>Quantity Delta</Label>
              <Input
                id='adjustment-qty'
                type='number'
                value={adjustment.quantityDelta}
                onChange={(event) =>
                  setAdjustment((prev) => ({
                    ...prev,
                    quantityDelta: event.target.value,
                  }))
                }
                placeholder='Use negative for stock-out'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='adjustment-reason'>Reason</Label>
              <Input
                id='adjustment-reason'
                value={adjustment.reason}
                onChange={(event) =>
                  setAdjustment((prev) => ({ ...prev, reason: event.target.value }))
                }
                placeholder='Cycle count correction'
              />
            </div>
            <div className='space-y-2'>
              <Label className='invisible'>Override</Label>
              <div className='flex h-10 items-center gap-2 rounded-md border px-3'>
                <Checkbox
                  id='negative-override'
                  checked={adjustment.allowNegativeOverride}
                  disabled={!canOverride}
                  onCheckedChange={(value) =>
                    setAdjustment((prev) => ({
                      ...prev,
                      allowNegativeOverride: !!value,
                    }))
                  }
                />
                <Label htmlFor='negative-override' className='text-sm'>
                  Manager negative override
                </Label>
              </div>
            </div>
            <div className='md:col-span-4 flex justify-end'>
              <Button
                onClick={() => adjustMutation.mutate()}
                disabled={adjustmentDisabled}
              >
                Apply Adjustment
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <GridToolbar
        query={q}
        onQueryChange={setQuery}
        placeholder='Filter inventory by product or SKU...'
      />

      <WmsGrid<InventoryRecord>
        rowData={rows}
        columnDefs={columns}
        loading={inventoryQuery.isLoading}
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
