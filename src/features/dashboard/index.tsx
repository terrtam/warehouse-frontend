import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { canAnyRole } from '@/lib/auth/permissions'
import { getCurrentRoles } from '@/lib/wms'
import { useAuthStore } from '@/stores/auth-store'
import { wmsQueryKeys, wmsRepository } from '@/services/wms'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { WmsPage } from '@/features/wms/components/wms-page'

const toDateInput = (date: Date) => date.toISOString().slice(0, 10)

const numberFormatter = new Intl.NumberFormat('en-US')
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

export function Dashboard() {
  const authRoles = useAuthStore((state) => state.auth.user?.role)
  const roles = useMemo(() => getCurrentRoles(), [authRoles])
  const isManager = canAnyRole(roles, 'dashboard:reports')

  const [fromDate, setFromDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return toDateInput(date)
  })
  const [toDate, setToDate] = useState(() => toDateInput(new Date()))

  const range = useMemo(() => ({ from: fromDate, to: toDate }), [fromDate, toDate])

  const inventoryQuery = useQuery({
    queryKey: wmsQueryKeys.inventory,
    queryFn: () => wmsRepository.inventory.list(),
  })
  const salesOrdersQuery = useQuery({
    queryKey: wmsQueryKeys.salesOrders,
    queryFn: () => wmsRepository.salesOrders.list(),
  })
  const purchaseOrdersQuery = useQuery({
    queryKey: wmsQueryKeys.purchaseOrders,
    queryFn: () => wmsRepository.purchaseOrders.list(),
  })
  const transactionsQuery = useQuery({
    queryKey: wmsQueryKeys.inventoryTransactions,
    queryFn: () => wmsRepository.inventoryTransactions.list(),
  })
  const productsQuery = useQuery({
    queryKey: wmsQueryKeys.products,
    queryFn: () => wmsRepository.products.list(),
  })
  const customersQuery = useQuery({
    queryKey: wmsQueryKeys.customers,
    queryFn: () => wmsRepository.customers.list(),
  })
  const suppliersQuery = useQuery({
    queryKey: wmsQueryKeys.suppliers,
    queryFn: () => wmsRepository.suppliers.list(),
  })

  const salesByProductQuery = useQuery({
    queryKey: [...wmsQueryKeys.reports.salesByProduct, range],
    queryFn: () => wmsRepository.reports.salesByProduct(range),
    enabled: isManager,
  })
  const salesByCategoryQuery = useQuery({
    queryKey: [...wmsQueryKeys.reports.salesByCategory, range],
    queryFn: () => wmsRepository.reports.salesByCategory(range),
    enabled: isManager,
  })
  const purchaseCostQuery = useQuery({
    queryKey: [...wmsQueryKeys.reports.purchaseCostTracking, range],
    queryFn: () => wmsRepository.reports.purchaseCostTracking(range),
    enabled: isManager,
  })
  const supplierPerformanceQuery = useQuery({
    queryKey: [...wmsQueryKeys.reports.supplierPerformance, range],
    queryFn: () => wmsRepository.reports.supplierPerformance(range),
    enabled: isManager,
  })
  const velocityQuery = useQuery({
    queryKey: [...wmsQueryKeys.reports.velocity, range],
    queryFn: () => wmsRepository.reports.velocity(range),
    enabled: isManager,
  })
  const lowStockTrendsQuery = useQuery({
    queryKey: wmsQueryKeys.reports.lowStockTrends,
    queryFn: () => wmsRepository.reports.lowStockTrends(),
    enabled: isManager,
  })

  const lowStockCount = (inventoryQuery.data ?? []).filter((item) => item.lowStock).length

  const openSalesOrders = (salesOrdersQuery.data ?? []).filter(
    (item) => item.status !== 'shipped' && item.status !== 'cancelled'
  ).length

  const pendingPurchaseOrders = (purchaseOrdersQuery.data ?? []).filter(
    (item) => item.status !== 'received' && item.status !== 'cancelled'
  ).length

  const recentTransactions = (transactionsQuery.data ?? []).slice(0, 8)

  const managerRevenue = sum((salesByProductQuery.data ?? []).map((item) => item.revenue))
  const managerPurchaseCost = sum(
    (purchaseCostQuery.data ?? []).map((item) => item.receivedCost)
  )
  const lowStockTrendCount = (lowStockTrendsQuery.data ?? []).filter(
    (item) => item.lowStock
  ).length
  const topVelocity = [...(velocityQuery.data ?? [])]
    .sort((a, b) => b.outbound - a.outbound)
    .slice(0, 1)[0]

  return (
    <WmsPage
      title='Dashboard'
      description='Operational warehouse metrics and recent inventory activity.'
    >
      {isManager && (
        <Card>
          <CardHeader>
            <CardTitle>Reporting Window</CardTitle>
          </CardHeader>
          <CardContent className='grid gap-3 sm:grid-cols-3'>
            <div className='space-y-2'>
              <label htmlFor='report-from' className='text-sm font-medium'>
                From
              </label>
              <Input
                id='report-from'
                type='date'
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <label htmlFor='report-to' className='text-sm font-medium'>
                To
              </label>
              <Input
                id='report-to'
                type='date'
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
              />
            </div>
            <div className='flex items-end'>
              <Button
                variant='outline'
                onClick={() => {
                  const today = new Date()
                  const start = new Date()
                  start.setDate(today.getDate() - 30)
                  setFromDate(toDateInput(start))
                  setToDate(toDateInput(today))
                }}
              >
                Last 30 Days
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <MetricCard title='Low Stock SKUs' value={numberFormatter.format(lowStockCount)} />
        <MetricCard title='Open Sales Orders' value={numberFormatter.format(openSalesOrders)} />
        <MetricCard
          title='Pending Purchase Orders'
          value={numberFormatter.format(pendingPurchaseOrders)}
        />
        <MetricCard
          title='Recent Inventory Movements'
          value={numberFormatter.format(recentTransactions.length)}
        />
      </div>

      {isManager && (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <MetricCard title='Sales Revenue' value={currencyFormatter.format(managerRevenue)} />
          <MetricCard
            title='Purchase Cost'
            value={currencyFormatter.format(managerPurchaseCost)}
          />
          <MetricCard
            title='Low Stock Trend Items'
            value={numberFormatter.format(lowStockTrendCount)}
          />
          <MetricCard
            title='Top Outbound SKU'
            value={topVelocity ? `${topVelocity.sku} (${topVelocity.outbound})` : 'N/A'}
          />
        </div>
      )}

      <div className='grid gap-4 lg:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>Recent Inventory Transactions</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            {recentTransactions.length === 0 && (
              <p className='text-sm text-muted-foreground'>No recent activity.</p>
            )}
            {recentTransactions.map((txn) => (
              <div
                key={txn.id}
                className='flex items-center justify-between rounded-md border p-3 text-sm'
              >
                <div>
                  <p className='font-medium'>{txn.productName}</p>
                  <p className='text-muted-foreground'>{`${txn.type} | ${txn.referenceType} ${txn.referenceId}`}</p>
                </div>
                <div className='text-right'>
                  <p className='font-medium'>{txn.quantity}</p>
                  <p className='text-muted-foreground'>
                    {new Date(txn.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isManager ? 'Manager Snapshot' : 'Staff Snapshot'}</CardTitle>
          </CardHeader>
          <CardContent className='space-y-2 text-sm'>
            <p>{`Active SKUs: ${(productsQuery.data ?? []).filter((item) => item.status === 'active').length}`}</p>
            <p>{`Total Customers: ${(customersQuery.data ?? []).length}`}</p>
            <p>{`Total Suppliers: ${(suppliersQuery.data ?? []).length}`}</p>
            {isManager ? (
              <p className='text-muted-foreground'>
                Manager view includes report-backed sales, cost, and supplier KPIs.
              </p>
            ) : (
              <p className='text-muted-foreground'>
                Staff view focuses on fulfillment, receiving, and stock movements.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {isManager && (
        <div className='grid gap-4 lg:grid-cols-2'>
          <Card>
            <CardHeader>
              <CardTitle>Sales by Category</CardTitle>
            </CardHeader>
            <CardContent className='space-y-2 text-sm'>
              {(salesByCategoryQuery.data ?? []).slice(0, 6).map((row) => (
                <div key={row.categoryName} className='flex items-center justify-between'>
                  <span>{row.categoryName}</span>
                  <span className='font-medium'>
                    {currencyFormatter.format(row.revenue)} / {row.shippedQuantity}
                  </span>
                </div>
              ))}
              {(salesByCategoryQuery.data ?? []).length === 0 && (
                <p className='text-muted-foreground'>No category revenue in range.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Supplier Performance</CardTitle>
            </CardHeader>
            <CardContent className='space-y-2 text-sm'>
              {(supplierPerformanceQuery.data ?? []).slice(0, 6).map((row) => (
                <div key={row.supplierId} className='flex items-center justify-between'>
                  <span>{row.supplierName}</span>
                  <span className='font-medium'>
                    {(row.receiveRate * 100).toFixed(0)}% / {row.avgLeadDays.toFixed(1)}d
                  </span>
                </div>
              ))}
              {(supplierPerformanceQuery.data ?? []).length === 0 && (
                <p className='text-muted-foreground'>No supplier metrics in range.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </WmsPage>
  )
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className='pb-2'>
        <CardTitle className='text-sm font-medium'>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='text-3xl font-bold'>{value}</div>
      </CardContent>
    </Card>
  )
}
