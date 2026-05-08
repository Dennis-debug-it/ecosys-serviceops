import { getClientName, getSiteName } from '../../app/selectors'
import { Badge } from '../../components/ui/Badge'
import type { DashboardMetrics } from '../../app/selectors'
import type { RequisitionRecord, TechnicianRecord, TenantData } from '../../types/app'
import { slaTone, technicianTone } from '../../utils/format'

export default function DashboardWidgets({
  data,
  metrics,
  activeTechnicians,
  pendingRequisitions,
  onOpenWorkOrder,
}: {
  data: TenantData
  metrics: DashboardMetrics
  activeTechnicians: TechnicianRecord[]
  pendingRequisitions: RequisitionRecord[]
  onOpenWorkOrder: (id: string) => void
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <article className="surface-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-app">SLA Watchlist</p>
            <p className="text-sm text-muted">Jobs with the highest response and resolution pressure.</p>
          </div>
          <Badge tone="warning">{metrics.slaWatchlist.length} flagged</Badge>
        </div>
        <div className="mt-4 space-y-3">
          {metrics.slaWatchlist.slice(0, 5).map((item) => (
            <button key={item.id} type="button" className="panel-subtle w-full rounded-[24px] p-4 text-left" onClick={() => onOpenWorkOrder(item.id)}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-app">{item.workOrderNumber}</p>
                <Badge tone={slaTone(item.slaStatus)}>{item.slaCountdown}</Badge>
              </div>
              <p className="mt-2 text-sm text-app">{item.title}</p>
              <p className="mt-1 text-xs text-muted">{item.clientName} - {item.siteName}</p>
            </button>
          ))}
        </div>
      </article>

      <article className="surface-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-app">Priority Work Orders</p>
            <p className="text-sm text-muted">Critical and high-priority dispatch queue.</p>
          </div>
          <Badge tone="danger">{metrics.priorityWorkOrders.length} live</Badge>
        </div>
        <div className="mt-4 space-y-3">
          {metrics.priorityWorkOrders.slice(0, 5).map((item) => (
            <button key={item.id} type="button" className="panel-subtle w-full rounded-[24px] p-4 text-left" onClick={() => onOpenWorkOrder(item.id)}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-app">{item.workOrderNumber}</p>
                <Badge tone={item.priority === 'Critical' ? 'danger' : 'warning'}>{item.priority}</Badge>
              </div>
              <p className="mt-2 text-sm text-app">{item.title}</p>
              <p className="mt-1 text-xs text-muted">Assigned to {item.technicianName}</p>
            </button>
          ))}
        </div>
      </article>

      <article className="surface-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-app">Technician Status</p>
            <p className="text-sm text-muted">Field presence and live workload.</p>
          </div>
          <Badge tone="info">{activeTechnicians.length} active</Badge>
        </div>
        <div className="mt-4 space-y-3">
          {activeTechnicians.slice(0, 6).map((technician) => (
            <div key={technician.id} className="panel-subtle flex items-center justify-between rounded-[24px] p-4">
              <div>
                <p className="text-sm font-semibold text-app">{technician.fullName}</p>
                <p className="mt-1 text-xs text-muted">{technician.activeWorkOrderIds.length} active jobs</p>
              </div>
              <Badge tone={technicianTone(technician.status)}>{technician.status}</Badge>
            </div>
          ))}
        </div>
      </article>

      <article className="surface-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-app">Materials Issues</p>
            <p className="text-sm text-muted">Low-stock items and open requisitions.</p>
          </div>
          <Badge tone="warning">{metrics.materialsIssues.length + pendingRequisitions.length} in focus</Badge>
        </div>
        <div className="mt-4 space-y-3">
          {metrics.materialsIssues.slice(0, 3).map((item) => (
            <div key={item.id} className="panel-subtle rounded-[24px] p-4">
              <p className="text-sm font-semibold text-app">{item.name}</p>
              <p className="mt-1 text-xs text-muted">{item.quantity} on hand - reorder {item.reorderLevel}</p>
            </div>
          ))}
          {pendingRequisitions.slice(0, 3).map((requisition) => {
            const linkedWorkOrder = data.workOrders.find((item) => item.id === requisition.workOrderId)

            return (
              <div key={requisition.id} className="panel-subtle rounded-[24px] p-4">
                <p className="text-sm font-semibold text-app">{requisition.requisitionNumber}</p>
                <p className="mt-1 text-xs text-muted">
                  {requisition.itemName} for {getClientName(data, linkedWorkOrder?.clientId ?? '')} - {getSiteName(data, linkedWorkOrder?.siteId ?? '')}
                </p>
              </div>
            )
          })}
        </div>
      </article>
    </section>
  )
}
