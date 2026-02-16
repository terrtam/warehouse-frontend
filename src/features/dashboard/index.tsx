import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { canAnyRole } from '@/lib/auth/permissions'
import { getCurrentRoles } from '@/lib/wms'
import { useAuthStore } from '@/stores/auth-store'
import { wmsQueryKeys, wmsRepository } from '@/services/wms'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { WmsPage } from '@/features/wms/components/wms-page'

export function Dashboard() {
  const authRoles = useAuthStore((state) => state.auth.user?.role)
  const roles = useMemo(() => getCurrentRoles(), [authRoles])
  const isManager = canAnyRole(roles, 'dashboard:reports')

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

  const lowStockCount = (inventoryQuery.data ?? []).filter(
    (item) => item.lowStock
  ).length

  const openSalesOrders = (salesOrdersQuery.data ?? []).filter(
    (item) => item.status !== 'shipped' && item.status !== 'cancelled'
  ).length

  const pendingPurchaseOrders = (purchaseOrdersQuery.data ?? []).filter(
    (item) => item.status !== 'received' && item.status !== 'cancelled'
  ).length

  const recentTransactions = (transactionsQuery.data ?? []).slice(0, 8)

  return (
    <WmsPage
      title='Dashboard'
      description='Operational warehouse metrics and recent inventory activity.'
    >
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <MetricCard title='Low Stock SKUs' value={String(lowStockCount)} />
        <MetricCard title='Open Sales Orders' value={String(openSalesOrders)} />
        <MetricCard
          title='Pending Purchase Orders'
          value={String(pendingPurchaseOrders)}
        />
        <MetricCard
          title='Recent Inventory Movements'
          value={String(recentTransactions.length)}
        />
      </div>

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
                  <p className='text-muted-foreground'>{`${txn.type} • ${txn.referenceType} ${txn.referenceId}`}</p>
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
                Manager view includes report-level KPIs and master-data management.
              </p>
            ) : (
              <p className='text-muted-foreground'>
                Staff view focuses on fulfillment, receiving, and stock movements.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
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
