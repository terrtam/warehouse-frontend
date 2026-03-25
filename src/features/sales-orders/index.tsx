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
import type { SalesOrder, SalesOrderLine } from '@/domain/wms/types'
import { WmsPage } from '@/features/wms/components/wms-page'
import { GridToolbar } from '@/features/wms/components/grid-toolbar'
import { extractSortState, sortRows } from '@/features/wms/grid-utils'

const route = getRouteApi('/_authenticated/sales-orders/')

type DraftLine = {
  productId: string
  productName: string
  supplierId?: string
  supplierName?: string
  quantity: number
  unitPrice: number
}

type SalesOrderRow = {
  id: string
  customerName: string
  status: string
  lineCount: number
  totalQuantity: number
  reservedQuantity: number
  backorderedQuantity: number
  createdAt: string
  updatedAt: string
}

export function SalesOrders() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const queryClient = useQueryClient()
  const authRoles = useAuthStore((state) => state.auth.user?.role)
  const parsedRoles = useMemo(() => getCurrentRoles(), [authRoles])
  const canCreate = canAnyRole(parsedRoles, 'sales-orders:create')
  const canConfirm = canAnyRole(parsedRoles, 'sales-orders:confirm')
  const canShip = canAnyRole(parsedRoles, 'sales-orders:ship')
  const canCancel = canAnyRole(parsedRoles, 'sales-orders:cancel')

  const { pagination, setPagination, q, setQuery, sortBy, sortDir, setSort } =
    useGridUrlState({
      search,
      navigate,
    })

  const salesOrdersQuery = useQuery({
    queryKey: wmsQueryKeys.salesOrders,
    queryFn: () => wmsRepository.salesOrders.list(),
  })

  const customersQuery = useQuery({
    queryKey: wmsQueryKeys.customers,
    queryFn: () => wmsRepository.customers.list(),
  })

  const productsQuery = useQuery({
    queryKey: wmsQueryKeys.products,
    queryFn: () => wmsRepository.products.list(),
  })
  const suppliersQuery = useQuery({
    queryKey: wmsQueryKeys.suppliers,
    queryFn: () => wmsRepository.suppliers.list(),
  })

  const [customerId, setCustomerId] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [lineProductId, setLineProductId] = useState('')
  const [lineQuantity, setLineQuantity] = useState('1')
  const [lineUnitPrice, setLineUnitPrice] = useState('')
  const [draftLines, setDraftLines] = useState<DraftLine[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [isShipDialogOpen, setIsShipDialogOpen] = useState(false)
  const [shipmentQty, setShipmentQty] = useState<Record<string, string>>({})

  const createMutation = useMutation({
    mutationFn: () =>
      wmsRepository.salesOrders.create(
        {
          customerId,
          lines: draftLines.map((line) => ({
            productId: line.productId,
            supplierId: line.supplierId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
          })),
        },
        getCurrentActor()
      ),
    onSuccess: () => {
      toast.success('Sales order created')
      setCustomerId('')
      setSupplierId('')
      setLineProductId('')
      setLineQuantity('1')
      setLineUnitPrice('')
      setDraftLines([])
      queryClient.invalidateQueries({ queryKey: wmsQueryKeys.salesOrders })
    },
    onError: handleWmsError,
  })

  const confirmMutation = useMutation({
    mutationFn: (row: SalesOrder) =>
      wmsRepository.salesOrders.confirm(row.id, getCurrentActor(), row.version),
    onSuccess: () => {
      toast.success('Sales order confirmed')
      queryClient.invalidateQueries({ queryKey: wmsQueryKeys.salesOrders })
    },
    onError: handleWmsError,
  })

  const cancelMutation = useMutation({
    mutationFn: (row: SalesOrder) =>
      wmsRepository.salesOrders.cancel(row.id, getCurrentActor(), row.version),
    onSuccess: () => {
      toast.success('Sales order cancelled')
      queryClient.invalidateQueries({ queryKey: wmsQueryKeys.salesOrders })
    },
    onError: handleWmsError,
  })

  const shipMutation = useMutation({
    mutationFn: (order: SalesOrder) => {
      const lines = order.lines
        .map((line) => ({
          lineId: line.id,
          quantity: Number(shipmentQty[line.id] ?? 0),
        }))
        .filter((line) => line.quantity > 0)
      return wmsRepository.salesOrders.ship(
        order.id,
        lines,
        getCurrentActor(),
        order.version
      )
    },
    onSuccess: () => {
      toast.success('Shipment processed')
      setShipmentQty({})
      setIsShipDialogOpen(false)
      setSelectedOrderId(null)
      queryClient.invalidateQueries({ queryKey: wmsQueryKeys.salesOrders })
      queryClient.invalidateQueries({ queryKey: wmsQueryKeys.inventory })
      queryClient.invalidateQueries({
        queryKey: wmsQueryKeys.inventoryTransactions,
      })
    },
    onError: handleWmsError,
  })

  const activeProducts = (productsQuery.data ?? []).filter(
    (item) => item.status === 'active'
  )

  const orderRows = useMemo<SalesOrderRow[]>(() => {
    const mapped = (salesOrdersQuery.data ?? []).map((order) => ({
      id: order.id,
      customerName: order.customerName,
      status: order.status,
      lineCount: order.lines.length,
      totalQuantity: order.lines.reduce(
        (sum, line) => sum + line.quantityOrdered,
        0
      ),
      reservedQuantity: order.lines.reduce(
        (sum, line) => sum + line.quantityReserved,
        0
      ),
      backorderedQuantity: order.lines.reduce(
        (sum, line) =>
          sum +
          Math.max(
            0,
            line.quantityOrdered - line.quantityShipped - line.quantityReserved
          ),
        0
      ),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    }))

    const lowered = q.toLowerCase()
    const filtered = mapped.filter((row) => {
      if (lowered.length === 0) return true
      return (
        row.id.toLowerCase().includes(lowered) ||
        row.customerName.toLowerCase().includes(lowered) ||
        row.status.toLowerCase().includes(lowered)
      )
    })

    return sortRows(filtered, sortBy, sortDir)
  }, [salesOrdersQuery.data, q, sortBy, sortDir])

  const selectedOrder = useMemo(
    () => (salesOrdersQuery.data ?? []).find((item) => item.id === selectedOrderId) ?? null,
    [salesOrdersQuery.data, selectedOrderId]
  )

  const columns = useMemo<ColDef<SalesOrderRow>[]>(
    () => [
      { field: 'id', headerName: 'Order ID', minWidth: 170 },
      { field: 'customerName', headerName: 'Customer' },
      { field: 'status', headerName: 'Status', minWidth: 160 },
      { field: 'lineCount', headerName: 'Lines', maxWidth: 110 },
      { field: 'totalQuantity', headerName: 'Ordered', maxWidth: 120 },
      { field: 'reservedQuantity', headerName: 'Reserved', maxWidth: 120 },
      { field: 'backorderedQuantity', headerName: 'Backorder', maxWidth: 130 },
      {
        field: 'createdAt',
        headerName: 'Created',
        valueFormatter: ({ value }) =>
          typeof value === 'string' ? new Date(value).toLocaleString() : '',
      },
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
        minWidth: 360,
        cellRenderer: (params: { data?: SalesOrderRow }) => {
          const row = params.data
          if (!row) return null
          const fullOrder = (salesOrdersQuery.data ?? []).find(
            (item) => item.id === row.id
          )
          if (!fullOrder) return null

          return (
            <div className='flex gap-2'>
              {canConfirm && fullOrder.status === 'draft' && (
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => {
                    confirmMutation.mutate(fullOrder)
                  }}
                >
                  Confirm
                </Button>
              )}
              {canShip &&
                (fullOrder.status === 'processing' ||
                  fullOrder.status === 'confirmed' ||
                  fullOrder.status === 'partially_shipped') && (
                  <Button
                    size='sm'
                    variant='outline'
                  onClick={() => {
                    setSelectedOrderId(fullOrder.id)
                    setIsShipDialogOpen(true)
                  }}
                >
                  Ship
                  </Button>
                )}
              {canCancel &&
                fullOrder.status !== 'cancelled' &&
                fullOrder.status !== 'shipped' &&
                fullOrder.status !== 'partially_shipped' && (
                  <Button
                    size='sm'
                    variant='destructive'
                    onClick={() => {
                      cancelMutation.mutate(fullOrder)
                    }}
                  >
                    Cancel
                  </Button>
                )}
            </div>
          )
        },
      },
    ],
    [canCancel, canConfirm, canShip, cancelMutation, confirmMutation, salesOrdersQuery.data]
  )

  const addLine = () => {
    const qty = Number(lineQuantity)
    if (!lineProductId || Number.isNaN(qty) || qty <= 0) return
    const product = activeProducts.find((item) => item.id === lineProductId)
    if (!product) return
    if (!supplierId) return
    const supplier = (suppliersQuery.data ?? []).find(
      (item) => item.id === supplierId
    )
    if (!supplier) return
    const explicitUnitPrice = Number(lineUnitPrice)
    const unitPrice =
      lineUnitPrice.trim().length === 0 || Number.isNaN(explicitUnitPrice)
        ? product.defaultSalePrice
        : explicitUnitPrice

    setDraftLines((prev) => {
      const existing = prev.find((line) => line.productId === lineProductId)
      if (!existing) {
        return [
          ...prev,
          {
            productId: product.id,
            productName: product.name,
            supplierId: supplier.id,
            supplierName: supplier.name,
            quantity: qty,
            unitPrice,
          },
        ]
      }
      return prev.map((line) =>
        line.productId === lineProductId
          ? { ...line, quantity: line.quantity + qty, unitPrice }
          : line
      )
    })
    setLineProductId('')
    setLineQuantity('1')
    setLineUnitPrice('')
  }

  const createDisabled =
    createMutation.isPending || !customerId || !supplierId || draftLines.length === 0

  const canShipSelected =
    selectedOrder &&
    (selectedOrder.status === 'processing' ||
      selectedOrder.status === 'confirmed' ||
      selectedOrder.status === 'partially_shipped')

  const shipDisabled =
    shipMutation.isPending ||
    !canShipSelected ||
    selectedOrder.lines.every((line) => Number(shipmentQty[line.id] ?? 0) <= 0)

  const handleShipDialogOpenChange = (open: boolean) => {
    setIsShipDialogOpen(open)
    if (!open) {
      setShipmentQty({})
      setSelectedOrderId(null)
    }
  }

  return (
    <WmsPage
      title='Sales Orders'
      description='Create, confirm, and ship outbound orders.'
    >
      {canCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Create Sales Order</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <Label>Customer</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder='Select customer' />
                  </SelectTrigger>
                  <SelectContent>
                    {(customersQuery.data ?? [])
                      .filter((item) => item.status === 'active')
                      .map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-2'>
                <Label>Supplier</Label>
                <Select
                  value={supplierId}
                  onValueChange={setSupplierId}
                  disabled={draftLines.length > 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Select supplier' />
                  </SelectTrigger>
                  <SelectContent>
                    {(suppliersQuery.data ?? [])
                      .filter((item) => item.status === 'active')
                      .map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className='text-xs text-muted-foreground'>
                  Applies to all lines in this order.
                </p>
              </div>
            </div>
            <div className='grid gap-4 md:grid-cols-5'>
              <div className='space-y-2'>
                <Label>Product</Label>
                <Select value={lineProductId} onValueChange={setLineProductId}>
                  <SelectTrigger>
                    <SelectValue placeholder='Select active product' />
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
                <Label htmlFor='so-line-qty'>Quantity</Label>
                <Input
                  id='so-line-qty'
                  type='number'
                  min='1'
                  value={lineQuantity}
                  onChange={(event) => setLineQuantity(event.target.value)}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='so-line-price'>Unit Price</Label>
                <Input
                  id='so-line-price'
                  type='number'
                  min='0'
                  step='0.01'
                  value={lineUnitPrice}
                  onChange={(event) => setLineUnitPrice(event.target.value)}
                  placeholder='Optional'
                />
              </div>
              <div className='flex items-end'>
                <Button variant='outline' onClick={addLine}>
                  Add Line
                </Button>
              </div>
            </div>

            {draftLines.length > 0 && (
              <div className='space-y-2 rounded-md border p-3'>
                <p className='text-sm font-medium'>Draft Lines</p>
                <p className='text-xs text-muted-foreground'>
                  Supplier: {draftLines[0]?.supplierName ?? 'N/A'}
                </p>
                {draftLines.map((line) => (
                  <div
                    key={line.productId}
                    className='flex items-center justify-between text-sm'
                  >
                    <span>{`${line.productName}${line.supplierName ? ` / ${line.supplierName}` : ''} x ${line.quantity} @ $${line.unitPrice.toFixed(2)}`}</span>
                    <Button
                      size='sm'
                      variant='ghost'
                      onClick={() => {
                        setDraftLines((prev) => {
                          const next = prev.filter(
                            (item) => item.productId !== line.productId
                          )
                          if (next.length === 0) {
                            setSupplierId('')
                          }
                          return next
                        })
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className='flex justify-end'>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createDisabled}
              >
                Create Sales Order
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {canShip && selectedOrder && (
        <Dialog open={isShipDialogOpen} onOpenChange={handleShipDialogOpenChange}>
          <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-3xl'>
            <DialogHeader className='text-start'>
              <DialogTitle>{`Ship ${selectedOrder.id}`}</DialogTitle>
              <DialogDescription>
                Enter shipped quantities for each line item.
              </DialogDescription>
            </DialogHeader>
            <div className='space-y-3'>
              {selectedOrder.lines.map((line: SalesOrderLine) => {
                const remaining = line.quantityOrdered - line.quantityShipped
                const backorder = Math.max(
                  0,
                  line.quantityOrdered - line.quantityReserved - line.quantityShipped
                )
                if (remaining <= 0) return null
                return (
                  <div key={line.id} className='grid gap-2 md:grid-cols-3'>
                    <Label className='self-center'>{`${line.productName} (ordered: ${line.quantityOrdered}, reserved: ${line.quantityReserved}, shipped: ${line.quantityShipped}, backorder: ${backorder})`}</Label>
                    <Input
                      type='number'
                      min='0'
                      max={Math.min(remaining, line.quantityReserved)}
                      value={shipmentQty[line.id] ?? ''}
                      onChange={(event) =>
                        setShipmentQty((prev) => ({
                          ...prev,
                          [line.id]: event.target.value,
                        }))
                      }
                    />
                  </div>
                )
              })}
            </div>
            <DialogFooter className='gap-2'>
              <Button
                variant='outline'
                onClick={() => {
                  handleShipDialogOpenChange(false)
                }}
              >
                Close
              </Button>
              <Button
                disabled={shipDisabled}
                onClick={() => {
                  if (!selectedOrder) return
                  shipMutation.mutate(selectedOrder)
                }}
              >
                Ship Quantities
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <GridToolbar
        query={q}
        onQueryChange={setQuery}
        placeholder='Filter sales orders...'
      />

      <WmsGrid<SalesOrderRow>
        rowData={orderRows}
        columnDefs={columns}
        loading={salesOrdersQuery.isLoading}
        pagination={pagination}
        onPaginationChange={setPagination}
        onFilterChange={() => {}}
        onSortChange={(model) => {
          const next = extractSortState(model)
          setSort(next.sortBy, next.sortDir)
        }}
        onRowClicked={(row) => {
          setSelectedOrderId(row.id)
        }}
      />
    </WmsPage>
  )
}
