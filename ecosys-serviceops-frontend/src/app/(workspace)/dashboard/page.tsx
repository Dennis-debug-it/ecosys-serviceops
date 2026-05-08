'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { ArrowRight, CalendarCheck2, FileChartColumn, Package, Wrench } from 'lucide-react'
import { PageHeader } from '@/saas/components/shared/PageHeader'
import { Badge } from '@/saas/components/ui/Badge'
import { DataTable } from '@/saas/components/ui/DataTable'
import { ProgressBar } from '@/saas/components/ui/ProgressBar'
import { StatCard } from '@/saas/components/ui/StatCard'
import { Timeline } from '@/saas/components/ui/Timeline'
import { useServiceOpsStore } from '@/store/useServiceOpsStore'
import { getBreadcrumbs, statusBadgeTone } from '@/saas/utils/formatters'
import type { WorkOrder } from '@/saas/types'

const delayClasses = ['', 'delay-1', 'delay-2', 'delay-3']
const workloadPalette = ['primary', 'emerald', 'rose', 'amber'] as const

export default function DashboardPage() {
  const tenant = useServiceOpsStore((state) => state.tenant)
  const stats = useServiceOpsStore((state) => state.stats)
  const trendPoints = useServiceOpsStore((state) => state.trendPoints)
  const slaMetrics = useServiceOpsStore((state) => state.slaMetrics)
  const workOrders = useServiceOpsStore((state) => state.workOrders)
  const commandCentreMetrics = useServiceOpsStore((state) => state.commandCentreMetrics)
  const commandCentreHealth = useServiceOpsStore((state) => state.commandCentreHealth)
  const timeRange = useServiceOpsStore((state) => state.timeRange)
  const setTimeRange = useServiceOpsStore((state) => state.setTimeRange)
  const openNewWorkOrderModal = useServiceOpsStore((state) => state.openNewWorkOrderModal)

  const recentWorkOrders = workOrders.slice(0, 4)
  const liveWorkflow = recentWorkOrders[0]

  const trendTotal = useMemo(
    () => trendPoints.reduce((total, point) => total + point.value, 0),
    [trendPoints],
  )

  const workload = useMemo(() => {
    const counts = workOrders.reduce<Record<string, { name: string; jobs: number }>>((accumulator, order) => {
      const current = accumulator[order.technician.name] ?? { name: order.technician.name, jobs: 0 }
      accumulator[order.technician.name] = { ...current, jobs: current.jobs + 1 }
      return accumulator
    }, {})

    return Object.values(counts)
      .sort((left, right) => right.jobs - left.jobs)
      .slice(0, 4)
      .map((technician, index) => {
        const capacity = index === 2 ? technician.jobs : Math.max(technician.jobs + 2, 6)
        return {
          ...technician,
          capacity,
          tone: workloadPalette[index] ?? 'primary',
          utilization: Math.min(100, Math.round((technician.jobs / capacity) * 100)),
        }
      })
  }, [workOrders])

  const workOrderColumns = [
    {
      key: 'number',
      header: 'WO Number',
      render: (row: WorkOrder) => (
        <Link href={`/work-orders/${row.id}`} className="text-mono">
          {row.number}
        </Link>
      ),
    },
    {
      key: 'client',
      header: 'Client / Asset',
      render: (row: WorkOrder) => `${row.client} / ${row.asset}`,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: WorkOrder) => <Badge tone={statusBadgeTone(row.status)}>{row.status}</Badge>,
    },
    {
      key: 'technician',
      header: 'Technician',
      render: (row: WorkOrder) => (
        <div className="table-person">
          <span className="avatar sm">{row.technician.initials}</span>
          <span>{row.technician.name}</span>
        </div>
      ),
    },
    {
      key: 'sla',
      header: 'SLA',
      render: (row: WorkOrder) => <span className={`sla-state tone-${statusBadgeTone(row.slaState)}`}>{row.slaLabel}</span>,
    },
  ]

  return (
    <>
      <PageHeader
        breadcrumbs={getBreadcrumbs('/dashboard')}
        title="ServiceOps Overview"
        description={`Tenant: ${tenant.name} • Branch: ${tenant.branch}`}
        actions={
          <>
            <div className="tabs">
              {(['Today', 'Week', 'Month'] as const).map((range) => (
                <button
                  key={range}
                  type="button"
                  className={`tab ${timeRange === range ? 'active' : ''}`}
                  onClick={() => setTimeRange(range)}
                >
                  {range}
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-primary" onClick={openNewWorkOrderModal}>
              + New Work Order
            </button>
          </>
        }
      />

      <div className="stats-grid">
        {stats.map((stat, index) => (
          <StatCard key={stat.id} stat={stat} delayClass={delayClasses[index] ?? ''} />
        ))}
      </div>

      <div className="grid-2">
        <section className="card animate-in delay-1">
          <div className="card-header">
            <span className="card-title">Work Order Trends</span>
            <span className="text-caption">Last 7 days</span>
          </div>
          <div className="trend-bars">
            {trendPoints.map((point) => (
              <div key={point.day} className="trend-bar-group">
                <div className="trend-bar" style={{ height: `${point.value}px`, opacity: 0.35 + point.value / 220 }} />
                <span className="trend-day">{point.day}</span>
              </div>
            ))}
          </div>
          <div className="summary-line">
            <span>Total: {trendTotal} jobs</span>
            <span className="trend-up">+ 7.2%</span>
          </div>
        </section>

        <section className="card animate-in delay-2">
          <div className="card-header">
            <span className="card-title">SLA Performance</span>
            <Badge tone="open">Real-time</Badge>
          </div>
          <div className="metric-stack">
            {slaMetrics.map((metric) => (
              <div key={metric.id} className="metric-block">
                <div className="metric-line">
                  <span>
                    {metric.label} ({metric.target})
                  </span>
                  <strong>{metric.value}%</strong>
                </div>
                <ProgressBar value={metric.value} tone={metric.tone} />
              </div>
            ))}
          </div>
          <div className="risk-caption">3 active SLA breaches need attention</div>
        </section>
      </div>

      <div className="grid-2">
        <section className="card animate-in delay-3">
          <div className="card-header">
            <span className="card-title">Recent Work Orders</span>
            <Link href="/work-orders" className="btn btn-ghost btn-sm">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          <DataTable columns={workOrderColumns} rows={recentWorkOrders} rowKey={(row) => row.id} />
        </section>

        <section className="card animate-in delay-3">
          <div className="card-header">
            <span className="card-title">Live Workflow - {liveWorkflow?.number}</span>
            {liveWorkflow ? <Badge tone={statusBadgeTone(liveWorkflow.status)}>{liveWorkflow.status}</Badge> : null}
          </div>
          {liveWorkflow ? <Timeline steps={liveWorkflow.timeline} /> : <div className="empty-message">No active workflow selected.</div>}
        </section>
      </div>

      <div className="grid-3">
        <section className="card animate-in delay-1">
          <div className="card-title mb-md">Quick Actions</div>
          <div className="quick-actions">
            <button type="button" className="btn btn-secondary w-full" onClick={openNewWorkOrderModal}>
              <Wrench size={16} /> Create Work Order
            </button>
            <Link href="/preventive-maintenance" className="btn btn-secondary w-full">
              <CalendarCheck2 size={16} /> Schedule PM
            </Link>
            <Link href="/stores-materials" className="btn btn-secondary w-full">
              <Package size={16} /> Issue Materials
            </Link>
            <Link href="/reports" className="btn btn-secondary w-full">
              <FileChartColumn size={16} /> Generate Report
            </Link>
          </div>
        </section>

        <section className="card animate-in delay-2">
          <div className="card-title mb-md">Technician Workload</div>
          <div className="metric-stack">
            {workload.map((technician) => (
              <div key={technician.name} className="metric-block">
                <div className="metric-line">
                  <span>{technician.name}</span>
                  <span>
                    {technician.jobs}/{technician.capacity} jobs
                  </span>
                </div>
                <ProgressBar value={technician.utilization} tone={technician.tone} />
              </div>
            ))}
          </div>
        </section>

        <section className="card animate-in delay-3">
          <div className="card-title mb-md">Watchlist</div>
          <div className="stack-list">
            {workOrders.slice(0, 3).map((order) => (
              <Link key={order.id} href={`/work-orders/${order.id}`} className="stack-list-item">
                <div>
                  <div className="stack-list-title">{order.number}</div>
                  <div className="stack-list-subtitle">
                    {order.client} • {order.asset}
                  </div>
                </div>
                <Badge tone={statusBadgeTone(order.slaState)}>{order.slaState}</Badge>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <section id="command-centre" className="card command-centre-card animate-in delay-4">
        <div className="card-header">
          <span className="card-title command-centre-title">Command Centre - Platform View</span>
          <Badge tone="pending">Superadmin Only</Badge>
        </div>
        <div className="grid-4">
          {commandCentreMetrics.map((metric) => (
            <div key={metric.id} className="command-metric">
              <div className="command-metric-value">{metric.value}</div>
              <div className="command-metric-label">{metric.label}</div>
              <div className="command-metric-detail">{metric.detail}</div>
            </div>
          ))}
        </div>
        <div className="command-health-row">
          {commandCentreHealth.map((health) => (
            <div key={health.id} className="command-health-chip">
              <Badge
                tone={statusBadgeTone(
                  health.status === 'Warning'
                    ? 'Near Limit'
                    : health.status === 'Critical'
                      ? 'Attention'
                      : 'Healthy',
                )}
              >
                {health.label}
              </Badge>
              <span>{health.detail}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
