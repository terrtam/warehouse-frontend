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
import type { PurchaseOrder, PurchaseOrderLine } from '@/domain/wms/types'
import { WmsPage } from '@/features/wms/components/wms-page'
import { GridToolbar } from '@/features/wms/components/grid-toolbar'
import { extractSortState, sortRows } from '@/features/wms/grid-utils'

const route = getRouteApi('/_authenticated/purchase-orders/')

type DraftLine = {
  productId: string
  productName: string
  quantity: number
}

type PurchaseOrderRow = {
  id: string
  supplierName: string
  status: string
  lineCount: number
  totalQuantity: number
  updatedAt: string
}

export function PurchaseOrders() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const queryClient = useQueryClient()
  const authRoles = useAuthStore((state) => state.auth.user?.role)
  const parsedRoles = useMemo(() => getCurrentRoles(), [authRoles])
  const canCreate = canAnyRole(parsedRoles, 'purchase-orders:create')
  const canOrder = canAnyRole(parsedRoles, 'purchase-orders:order')
  const canReceive = canAnyRole(parsedRoles, 'purchase-orders:receive')
  const canCancel = canAnyRole(parsedRoles, 'purchase-orders:cancel')

  const { pagination, setPagination, q, setQuery, sortBy, sortDir, setSort } =
    useGridUrlState({
      search,
      navigate,
    })

  const purchaseOrdersQuery = useQuery({
    queryKey: wmsQueryKeys.purchaseOrders,
    queryFn: () => wmsRepository.purchaseOrders.list(),
  })

  const suppliersQuery = useQuery({
    queryKey: wmsQueryKeys.suppliers,
    queryFn: () => wmsRepository.suppliers.list(),
  })

  const productsQuery = useQuery({
    queryKey: wmsQueryKeys.products,
    queryFn: () => wmsRepository.products.list(),
  })

  const [supplierId, setSupplierId] = useState('')
  const [lineProductId, setLineProductId] = useState('')
  const [lineQuantity, setLineQuantity] = useState('1')
  const [draftLines, setDraftLines] = useState<DraftLine[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [receiptQty, setReceiptQty] = useState<Record<string, string>>({})

  const createMutation = useMutation({
    mutationFn: () =>
      wmsRepository.purchaseOrders.create(
        {
          supplierId,
          lines: draftLines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
          })),
        },
        getCurrentActor()
      ),
    onSuccess: () => {
      toast.success('Purchase order created')
      setSupplierId('')
      setLineProductId('')
      setLineQuantity('1')
      setDraftLines([])
      queryClient.invalidateQueries({ queryKey: wmsQueryKeys.purchaseOrders })
    },
    onError: handleWmsError,
  })

  const orderMutation = useMutation({
    mutationFn: (row: PurchaseOrder) =>
      wmsRepository.purchaseOrders.order(row.id, getCurrentActor(), row.version),
    onSuccess: () => {
      toast.success('Purchase order marked as ordered')
      queryClient.invalidateQueries({ queryKey: wmsQueryKeys.purchaseOrders })
    },
    onError: handleWmsError,
  })

  const cancelMutation = useMutation({
    mutationFn: (row: PurchaseOrder) =>
      wmsRepository.purchaseOrders.cancel(row.id, getCurrentActor(), row.version),
    onSuccess: () => {
      toast.success('Purchase order cancelled')
      queryClient.invalidateQueries({ queryKey: wmsQueryKeys.purchaseOrders })
    },
    onError: handleWmsError,
  })

  const receiveMutation = useMutation({
    mutationFn: (order: PurchaseOrder) => {
      const lines = order.lines
        .map((line) => ({
          lineId: line.id,
          quantity: Number(receiptQty[line.id] ?? 0),
        }))
        .filter((line) => line.quantity > 0)
      return wmsRepository.purchaseOrders.receive(
        order.id,
        lines,
        getCurrentActor(),
        order.version
      )
    },
    onSuccess: () => {
      toast.success('Receipt processed')
      setReceiptQty({})
      queryClient.invalidateQueries({ queryKey: wmsQueryKeys.purchaseOrders })
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

  const orderRows = useMemo<PurchaseOrderRow[]>(() => {
    const mapped = (purchaseOrdersQuery.data ?? []).map((order) => ({
      id: order.id,
      supplierName: order.supplierName,
      status: order.status,
      lineCount: order.lines.length,
      totalQuantity: order.lines.reduce((sum, line) => sum + line.quantity, 0),
      updatedAt: order.updatedAt,
    }))

    const lowered = q.toLowerCase()
    const filtered = mapped.filter((row) => {
      if (lowered.length === 0) return true
      return (
        row.id.toLowerCase().includes(lowered) ||
        row.supplierName.toLowerCase().includes(lowered) ||
        row.status.toLowerCase().includes(lowered)
      )
    })

    return sortRows(filtered, sortBy, sortDir)
  }, [purchaseOrdersQuery.data, q, sortBy, sortDir])

  const selectedOrder = useMemo(
    () =>
      (purchaseOrdersQuery.data ?? []).find((item) => item.id === selectedOrderId) ??
      null,
    [purchaseOrdersQuery.data, selectedOrderId]
  )

  const columns = useMemo<ColDef<PurchaseOrderRow>[]>(
    () => [
      { field: 'id', headerName: 'Order ID', minWidth: 170 },
      { field: 'supplierName', headerName: 'Supplier' },
      { field: 'status', headerName: 'Status', minWidth: 170 },
      { field: 'lineCount', headerName: 'Lines', maxWidth: 110 },
      { field: 'totalQuantity', headerName: 'Qty', maxWidth: 110 },
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
        cellRenderer: (params: { data?: PurchaseOrderRow }) => {
          const row = params.data
          if (!row) return null
          const fullOrder = (purchaseOrdersQuery.data ?? []).find(
            (item) => item.id === row.id
          )
          if (!fullOrder) return null

          return (
            <div className='flex gap-2'>
              {canOrder && fullOrder.status === 'draft' && (
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => {
                    orderMutation.mutate(fullOrder)
                  }}
                >
                  Mark Ordered
                </Button>
              )}
              {canReceive &&
                (fullOrder.status === 'ordered' ||
                  fullOrder.status === 'partially_received') && (
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => {
                      setSelectedOrderId(fullOrder.id)
                    }}
                  >
                    Receive
                  </Button>
                )}
              {canCancel &&
                fullOrder.status !== 'cancelled' &&
                fullOrder.status !== 'received' &&
                fullOrder.status !== 'partially_received' && (
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
    [canCancel, canOrder, canReceive, cancelMutation, orderMutation, purchaseOrdersQuery.data]
  )

  const addLine = () => {
    const qty = Number(lineQuantity)
    if (!lineProductId || Number.isNaN(qty) || qty <= 0) return
    const product = activeProducts.find((item) => item.id === lineProductId)
    if (!product) return

    setDraftLines((prev) => {
      const existing = prev.find((line) => line.productId === lineProductId)
      if (!existing) {
        return [...prev, { productId: product.id, productName: product.name, quantity: qty }]
      }
      return prev.map((line) =>
        line.productId === lineProductId
          ? { ...line, quantity: line.quantity + qty }
          : line
      )
    })
    setLineProductId('')
    setLineQuantity('1')
  }

  const createDisabled =
    createMutation.isPending || !supplierId || draftLines.length === 0

  const canReceiveSelected =
    selectedOrder &&
    (selectedOrder.status === 'ordered' ||
      selectedOrder.status === 'partially_received')

  const receiveDisabled =
    receiveMutation.isPending ||
    !canReceiveSelected ||
    selectedOrder.lines.every((line) => Number(receiptQty[line.id] ?? 0) <= 0)

  return (
    <WmsPage
      title='Purchase Orders'
      description='Create, place, and receive inbound purchase orders.'
    >
      {canCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Create Purchase Order</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid gap-4 md:grid-cols-4'>
              <div className='space-y-2'>
                <Label>Supplier</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
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
              </div>
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
                <Label htmlFor='po-line-qty'>Quantity</Label>
                <Input
                  id='po-line-qty'
                  type='number'
                  min='1'
                  value={lineQuantity}
                  onChange={(event) => setLineQuantity(event.target.value)}
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
                {draftLines.map((line) => (
                  <div
                    key={line.productId}
                    className='flex items-center justify-between text-sm'
                  >
                    <span>{`${line.productName} x ${line.quantity}`}</span>
                    <Button
                      size='sm'
                      variant='ghost'
                      onClick={() =>
                        setDraftLines((prev) =>
                          prev.filter((item) => item.productId !== line.productId)
                        )
                      }
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
                Create Purchase Order
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {canReceive && selectedOrder && (
        <Card>
          <CardHeader>
            <CardTitle>{`Receive ${selectedOrder.id}`}</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            {selectedOrder.lines.map((line: PurchaseOrderLine) => {
              const remaining = line.quantity - line.receivedQuantity
              if (remaining <= 0) return null
              return (
                <div key={line.id} className='grid gap-2 md:grid-cols-3'>
                  <Label className='self-center'>{`${line.productName} (remaining: ${remaining})`}</Label>
                  <Input
                    type='number'
                    min='0'
                    max={remaining}
                    value={receiptQty[line.id] ?? ''}
                    onChange={(event) =>
                      setReceiptQty((prev) => ({
                        ...prev,
                        [line.id]: event.target.value,
                      }))
                    }
                  />
                </div>
              )
            })}
            <div className='flex justify-end gap-2'>
              <Button
                variant='outline'
                onClick={() => {
                  setSelectedOrderId(null)
                  setReceiptQty({})
                }}
              >
                Close
              </Button>
              <Button
                disabled={receiveDisabled}
                onClick={() => {
                  if (!selectedOrder) return
                  receiveMutation.mutate(selectedOrder)
                }}
              >
                Receive Quantities
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <GridToolbar
        query={q}
        onQueryChange={setQuery}
        placeholder='Filter purchase orders...'
      />

      <WmsGrid<PurchaseOrderRow>
        rowData={orderRows}
        columnDefs={columns}
        loading={purchaseOrdersQuery.isLoading}
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
