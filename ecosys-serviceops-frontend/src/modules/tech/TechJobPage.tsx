import { CheckSquare, ClipboardList, Image, ListChecks, Wrench } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink, useLocation, useParams } from 'react-router-dom'
import { ErrorState } from '../../components/ui/ErrorState'
import { LoadingState } from '../../components/ui/LoadingState'
import { useToast } from '../../components/ui/ToastProvider'
import { useAsyncData } from '../../hooks/useAsyncData'
import { materialService } from '../../services/materialService'
import { technicianJobsService } from '../../services/technicianJobsService'
import { workOrderService } from '../../services/workOrderService'
import type { MaterialItem, WorkOrder, WorkOrderExecutionBundle } from '../../types/api'
import { formatDateOnly } from '../../utils/date'
import { WorkOrderExecutionWorkspace } from '../work-orders/WorkOrderExecutionWorkspace'

type TechnicianJobPayload = {
  workOrder: WorkOrder | null
  execution: WorkOrderExecutionBundle | null
  materials: MaterialItem[]
}

const emptyPayload: TechnicianJobPayload = {
  workOrder: null,
  execution: null,
  materials: [],
}

export function TechJobPage() {
  const { id = '' } = useParams()
  const location = useLocation()
  const { pushToast } = useToast()

  const { data, loading, error, reload } = useAsyncData<TechnicianJobPayload>(
    async (signal) => {
      const workOrder = await technicianJobsService.get(id, signal)
      const [execution, materials] = await Promise.all([
        workOrderService.getExecution(id, signal),
        materialService.list({ branchId: workOrder.branchId, signal }),
      ])

      return { workOrder, execution, materials }
    },
    emptyPayload,
    [id],
  )

  if (loading) {
    return <LoadingState label="Loading technician job" />
  }

  if (error || !data.workOrder) {
    return <ErrorState title="Unable to load technician job" description={error || 'The selected job is no longer available.'} />
  }

  const workOrder = data.workOrder
  const activeSection = resolveSection(location.pathname)

  return (
    <div className="space-y-5 pb-28" data-testid="tech-job-page">
      <section className="surface-card">
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{workOrder.workOrderNumber}</p>
              <h2 className="mt-2 text-2xl font-semibold text-app">{workOrder.title}</h2>
              <p className="mt-2 text-sm text-muted">{workOrder.description || 'Use the cards below to update your field progress and close the job cleanly.'}</p>
            </div>
            <div className="rounded-3xl border border-app px-4 py-3 text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Active section</p>
              <p className="mt-2 text-base font-semibold text-app">{sectionLabel(activeSection)}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InfoCard label="Client" value={workOrder.clientName || 'Not set'} />
            <InfoCard label="Site" value={workOrder.siteName || workOrder.assetName || 'Field visit'} />
            <InfoCard label="Due date" value={workOrder.dueDate ? formatDateOnly(workOrder.dueDate) : 'No due date'} />
            <InfoCard label="Status" value={workOrder.status} />
          </div>
        </div>
      </section>

      <WorkOrderExecutionWorkspace
        workOrder={workOrder}
        execution={data.execution}
        materials={data.materials}
        onReload={reload}
        pushToast={pushToast}
      />

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-app bg-app/95 px-3 py-3 backdrop-blur" data-testid="tech-bottom-bar">
        <div className="mx-auto grid max-w-6xl grid-cols-5 gap-2">
          <TechNavLink to={`/tech/jobs/${id}`} active={activeSection === 'overview'} icon={<ClipboardList className="size-4" />} label="Overview" />
          <TechNavLink to={`/tech/jobs/${id}/checklist`} active={activeSection === 'checklist'} icon={<ListChecks className="size-4" />} label="Checklist" />
          <TechNavLink to={`/tech/jobs/${id}/photos`} active={activeSection === 'photos'} icon={<Image className="size-4" />} label="Photos" />
          <TechNavLink to={`/tech/jobs/${id}/complete`} active={activeSection === 'complete'} icon={<CheckSquare className="size-4" />} label="Complete" />
          <TechNavLink to="/tech" active={false} icon={<Wrench className="size-4" />} label="Jobs" />
        </div>
      </nav>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel-subtle rounded-2xl p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 text-sm font-medium text-app">{value}</p>
    </div>
  )
}

function TechNavLink({
  to,
  active,
  icon,
  label,
}: {
  to: string
  active: boolean
  icon: ReactNode
  label: string
}) {
  return (
    <NavLink
      to={to}
      className={`flex min-h-16 flex-col items-center justify-center rounded-2xl border px-2 text-center text-xs font-semibold ${
        active
          ? 'border-brand-primary bg-brand-primary text-white'
          : 'border-app bg-white/80 text-app'
      }`}
    >
      {icon}
      <span className="mt-1">{label}</span>
    </NavLink>
  )
}

function resolveSection(pathname: string) {
  if (pathname.endsWith('/checklist')) return 'checklist'
  if (pathname.endsWith('/photos')) return 'photos'
  if (pathname.endsWith('/complete')) return 'complete'
  return 'overview'
}

function sectionLabel(section: string) {
  if (section === 'checklist') return 'Checklist and readings'
  if (section === 'photos') return 'Photos and evidence'
  if (section === 'complete') return 'Completion and sign-off'
  return 'Overview and progress'
}
