'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ClipboardList, Package, ShieldAlert, UserRound, Wrench } from 'lucide-react'
import { PageHeader } from '@/saas/components/shared/PageHeader'
import { Badge } from '@/saas/components/ui/Badge'
import { Timeline } from '@/saas/components/ui/Timeline'
import { useServiceOpsStore } from '@/store/useServiceOpsStore'
import { priorityTone, statusBadgeTone } from '@/saas/utils/formatters'

export default function WorkOrderDetailPage() {
  const params = useParams<{ workOrderId: string }>()
  const workOrders = useServiceOpsStore((state) => state.workOrders)
  const workOrderId = params?.workOrderId ?? ''
  const workOrder = workOrders.find((entry) => entry.id === workOrderId)

  if (!workOrder) {
    return (
      <section className="card">
        <div className="card-title mb-md">Work order not found</div>
        <p className="summary-note">The requested job may have been removed from the mock workspace.</p>
        <div className="mt-md">
          <Link href="/work-orders" className="btn btn-primary">
            Back to Work Orders
          </Link>
        </div>
      </section>
    )
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Work Orders', href: '/work-orders' },
          { label: workOrder.number },
        ]}
        title={workOrder.title}
        description={`${workOrder.client} • ${workOrder.site} • ${workOrder.branch}`}
        actions={
          <>
            <Badge tone={statusBadgeTone(workOrder.status)}>{workOrder.status}</Badge>
            <Badge tone={priorityTone(workOrder.priority)}>{workOrder.priority}</Badge>
            <Badge tone={statusBadgeTone(workOrder.slaState)}>{workOrder.slaState}</Badge>
          </>
        }
      />

      <div className="detail-grid">
        <section className="card">
          <div className="card-header">
            <span className="card-title">Work Order Overview</span>
            <span className="text-mono">{workOrder.number}</span>
          </div>
          <div className="detail-list">
            <div className="detail-item">
              <span className="detail-label">Description</span>
              <p>{workOrder.description}</p>
            </div>
            <div className="detail-item">
              <span className="detail-label">Category</span>
              <p>{workOrder.category}</p>
            </div>
            <div className="detail-item">
              <span className="detail-label">Cost Impact</span>
              <p>{workOrder.costImpact}</p>
            </div>
            <div className="detail-item">
              <span className="detail-label">Created</span>
              <p>{workOrder.createdAt}</p>
            </div>
            <div className="detail-item">
              <span className="detail-label">Scheduled</span>
              <p>{workOrder.scheduledAt}</p>
            </div>
          </div>
          <div className="card-chip-row mt-md">
            <Link href="/stores-materials" className="btn btn-secondary">
              <Package size={16} /> Materials
            </Link>
            <Link href="/assets" className="btn btn-secondary">
              <Wrench size={16} /> Related Asset
            </Link>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <span className="card-title">Service Context</span>
            <ShieldAlert size={16} />
          </div>
          <div className="detail-list">
            <div className="detail-item">
              <span className="detail-label">Client</span>
              <p>{workOrder.client}</p>
            </div>
            <div className="detail-item">
              <span className="detail-label">Site</span>
              <p>{workOrder.site}</p>
            </div>
            <div className="detail-item">
              <span className="detail-label">Asset</span>
              <p>{workOrder.asset}</p>
            </div>
            <div className="detail-item">
              <span className="detail-label">Technician</span>
              <p className="table-person">
                <span className="avatar sm">{workOrder.technician.initials}</span>
                <span>{workOrder.technician.name}</span>
              </p>
            </div>
            <div className="detail-item">
              <span className="detail-label">SLA State</span>
              <p>{workOrder.slaLabel}</p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-header">
            <span className="card-title">Workflow Timeline</span>
            <ClipboardList size={16} />
          </div>
          <Timeline steps={workOrder.timeline} />
        </section>

        <section className="card">
          <div className="card-header">
            <span className="card-title">Field Notes</span>
            <UserRound size={16} />
          </div>
          <div className="stack-list">
            {workOrder.notes.map((note) => (
              <div key={note} className="stack-list-item static">
                <div className="stack-list-title">{note}</div>
              </div>
            ))}
          </div>
          <div className="card-header mt-lg">
            <span className="card-title">Requested Materials</span>
            <Package size={16} />
          </div>
          <div className="card-chip-row">
            {workOrder.materialsRequested.length > 0 ? (
              workOrder.materialsRequested.map((item) => (
                <Badge key={item} tone="pending">
                  {item}
                </Badge>
              ))
            ) : (
              <span className="summary-note">No materials requested.</span>
            )}
          </div>
        </section>
      </div>
    </>
  )
}
