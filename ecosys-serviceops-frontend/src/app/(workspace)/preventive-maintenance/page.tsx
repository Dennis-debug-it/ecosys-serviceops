'use client'

import { CalendarClock, CircleCheckBig, Hourglass, Siren } from 'lucide-react'
import { PageHeader } from '@/saas/components/shared/PageHeader'
import { Badge } from '@/saas/components/ui/Badge'
import { DataTable } from '@/saas/components/ui/DataTable'
import { useServiceOpsStore } from '@/store/useServiceOpsStore'
import { getBreadcrumbs, statusBadgeTone } from '@/saas/utils/formatters'
import type { PreventiveTask } from '@/saas/types'

export default function PreventiveMaintenancePage() {
  const preventiveTasks = useServiceOpsStore((state) => state.preventiveTasks)

  const columns = [
    {
      key: 'asset',
      header: 'Asset',
      render: (row: PreventiveTask) => row.asset,
    },
    {
      key: 'branch',
      header: 'Branch',
      render: (row: PreventiveTask) => row.branch,
    },
    {
      key: 'due',
      header: 'Due Date',
      render: (row: PreventiveTask) => row.dueDate,
    },
    {
      key: 'frequency',
      header: 'Frequency',
      render: (row: PreventiveTask) => row.frequency,
    },
    {
      key: 'assignee',
      header: 'Assignee',
      render: (row: PreventiveTask) => (
        <div className="table-person">
          <span className="avatar sm">{row.assignee.initials}</span>
          <span>{row.assignee.name}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: PreventiveTask) => <Badge tone={statusBadgeTone(row.status)}>{row.status}</Badge>,
    },
  ]

  return (
    <>
      <PageHeader
        breadcrumbs={getBreadcrumbs('/preventive-maintenance')}
        title="Preventive Maintenance"
        description="Calendar-driven PM execution with clear due-state visibility for field teams and service leads."
      />

      <div className="grid-4">
        <div className="metric-card">
          <CalendarClock size={18} />
          <div className="summary-value">{preventiveTasks.length}</div>
          <div className="summary-note">Scheduled PM tasks</div>
        </div>
        <div className="metric-card">
          <Hourglass size={18} />
          <div className="summary-value">{preventiveTasks.filter((task) => task.status === 'Due Today').length}</div>
          <div className="summary-note">Due today</div>
        </div>
        <div className="metric-card">
          <Siren size={18} />
          <div className="summary-value">{preventiveTasks.filter((task) => task.status === 'Overdue').length}</div>
          <div className="summary-note">Overdue PMs</div>
        </div>
        <div className="metric-card">
          <CircleCheckBig size={18} />
          <div className="summary-value">{preventiveTasks.filter((task) => task.status === 'Completed').length}</div>
          <div className="summary-note">Completed this cycle</div>
        </div>
      </div>

      <section className="card">
        <div className="card-header">
          <span className="card-title">PM Execution Queue</span>
          <span className="text-caption">Automation-ready task schedule</span>
        </div>
        <DataTable columns={columns} rows={preventiveTasks} rowKey={(row) => row.id} />
      </section>
    </>
  )
}
