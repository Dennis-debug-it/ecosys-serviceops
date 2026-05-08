'use client'

import Link from 'next/link'
import { AlertTriangle, Boxes, PackageCheck, ShoppingCart } from 'lucide-react'
import { PageHeader } from '@/saas/components/shared/PageHeader'
import { Badge } from '@/saas/components/ui/Badge'
import { DataTable } from '@/saas/components/ui/DataTable'
import { useServiceOpsStore } from '@/store/useServiceOpsStore'
import { getBreadcrumbs, statusBadgeTone } from '@/saas/utils/formatters'
import type { MaterialItem, WorkOrder } from '@/saas/types'

export default function StoresMaterialsPage() {
  const materials = useServiceOpsStore((state) => state.materials)
  const workOrders = useServiceOpsStore((state) => state.workOrders)

  const requisitions = workOrders.filter((order) => order.materialsRequested.length > 0)

  const columns = [
    {
      key: 'item',
      header: 'Item',
      render: (row: MaterialItem) => (
        <div>
          <div className="stack-list-title">{row.name}</div>
          <div className="stack-list-subtitle text-mono">{row.sku}</div>
        </div>
      ),
    },
    {
      key: 'branch',
      header: 'Branch',
      render: (row: MaterialItem) => row.branch,
    },
    {
      key: 'stock',
      header: 'On Hand',
      render: (row: MaterialItem) => row.stock,
    },
    {
      key: 'reorder',
      header: 'Reorder',
      render: (row: MaterialItem) => row.reorderLevel,
    },
    {
      key: 'reserved',
      header: 'Reserved',
      render: (row: MaterialItem) => row.reserved,
    },
    {
      key: 'state',
      header: 'State',
      render: (row: MaterialItem) => <Badge tone={statusBadgeTone(row.state)}>{row.state}</Badge>,
    },
  ]

  return (
    <>
      <PageHeader
        breadcrumbs={getBreadcrumbs('/stores-materials')}
        title="Stores & Materials"
        description="Branch-aware inventory visibility, low-stock risk and direct linkage to active requisitions."
      />

      <div className="grid-4">
        <div className="metric-card">
          <Boxes size={18} />
          <div className="summary-value">{materials.length}</div>
          <div className="summary-note">Managed stock items</div>
        </div>
        <div className="metric-card">
          <AlertTriangle size={18} />
          <div className="summary-value">{materials.filter((item) => item.state === 'Low Stock').length}</div>
          <div className="summary-note">Low stock warnings</div>
        </div>
        <div className="metric-card">
          <ShoppingCart size={18} />
          <div className="summary-value">{requisitions.length}</div>
          <div className="summary-note">Linked requisitions</div>
        </div>
        <div className="metric-card">
          <PackageCheck size={18} />
          <div className="summary-value">{materials.filter((item) => item.state === 'Reserved').length}</div>
          <div className="summary-note">Reserved for jobs</div>
        </div>
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-header">
            <span className="card-title">Inventory Register</span>
            <span className="text-caption">Live by store branch</span>
          </div>
          <DataTable columns={columns} rows={materials} rowKey={(row) => row.id} />
        </section>

        <section className="card">
          <div className="card-header">
            <span className="card-title">Requisition Watchlist</span>
            <span className="text-caption">{requisitions.length} work orders linked</span>
          </div>
          <div className="stack-list">
            {requisitions.map((order) => (
              <LinkCard key={order.id} workOrder={order} />
            ))}
          </div>
        </section>
      </div>
    </>
  )
}

function LinkCard({ workOrder }: { workOrder: WorkOrder }) {
  return (
    <Link href={`/work-orders/${workOrder.id}`} className="stack-list-item">
      <div>
        <div className="stack-list-title">{workOrder.number}</div>
        <div className="stack-list-subtitle">
          {workOrder.client} • {workOrder.materialsRequested.join(', ')}
        </div>
      </div>
      <Badge tone={statusBadgeTone(workOrder.status)}>{workOrder.status}</Badge>
    </Link>
  )
}
