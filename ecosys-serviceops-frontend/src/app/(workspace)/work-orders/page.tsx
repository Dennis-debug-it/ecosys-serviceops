'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ArrowRightLeft, Funnel, SlidersHorizontal } from 'lucide-react'
import { PageHeader } from '@/saas/components/shared/PageHeader'
import { Badge } from '@/saas/components/ui/Badge'
import { DataTable } from '@/saas/components/ui/DataTable'
import { useServiceOpsStore } from '@/store/useServiceOpsStore'
import { getBreadcrumbs, priorityTone, statusBadgeTone } from '@/saas/utils/formatters'
import type { Priority, WorkOrder, WorkOrderStatus } from '@/saas/types'

export default function WorkOrdersPage() {
  const workOrders = useServiceOpsStore((state) => state.workOrders)
  const searchQuery = useServiceOpsStore((state) => state.searchQuery)
  const openNewWorkOrderModal = useServiceOpsStore((state) => state.openNewWorkOrderModal)
  const [statusFilter, setStatusFilter] = useState<'All' | WorkOrderStatus>('All')
  const [priorityFilter, setPriorityFilter] = useState<'All' | Priority>('All')

  const filteredOrders = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    return workOrders.filter((order) => {
      const matchesStatus = statusFilter === 'All' || order.status === statusFilter
      const matchesPriority = priorityFilter === 'All' || order.priority === priorityFilter
      const matchesSearch =
        normalizedQuery.length === 0 ||
        [order.number, order.title, order.client, order.site, order.asset, order.technician.name]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery)

      return matchesStatus && matchesPriority && matchesSearch
    })
  }, [priorityFilter, searchQuery, statusFilter, workOrders])

  const columns = [
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
      key: 'summary',
      header: 'Job Summary',
      render: (row: WorkOrder) => (
        <div>
          <div className="stack-list-title">{row.title}</div>
          <div className="stack-list-subtitle">
            {row.client} • {row.site}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: WorkOrder) => <Badge tone={statusBadgeTone(row.status)}>{row.status}</Badge>,
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (row: WorkOrder) => <Badge tone={priorityTone(row.priority)}>{row.priority}</Badge>,
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
      render: (row: WorkOrder) => <Badge tone={statusBadgeTone(row.slaState)}>{row.slaState}</Badge>,
    },
    {
      key: 'scheduled',
      header: 'Scheduled',
      render: (row: WorkOrder) => row.scheduledAt,
    },
  ]

  return (
    <>
      <PageHeader
        breadcrumbs={getBreadcrumbs('/work-orders')}
        title="Work Orders"
        description={`${filteredOrders.length} jobs matched against live filters and the global workspace search.`}
        actions={
          <>
            <button type="button" className="btn btn-secondary">
              <ArrowRightLeft size={16} /> Dispatch Board
            </button>
            <button type="button" className="btn btn-primary" onClick={openNewWorkOrderModal}>
              + New Work Order
            </button>
          </>
        }
      />

      <div className="grid-3">
        <div className="summary-card">
          <div className="text-caption">Open Queue</div>
          <div className="summary-value">{workOrders.filter((order) => order.status === 'Open').length}</div>
          <div className="summary-note">Awaiting assignment or acceptance</div>
        </div>
        <div className="summary-card">
          <div className="text-caption">In Motion</div>
          <div className="summary-value">{workOrders.filter((order) => order.status === 'In Progress').length}</div>
          <div className="summary-note">Field jobs currently underway</div>
        </div>
        <div className="summary-card">
          <div className="text-caption">At Risk</div>
          <div className="summary-value">{workOrders.filter((order) => order.slaState !== 'On Track').length}</div>
          <div className="summary-note">Needs watchlist and escalation cover</div>
        </div>
      </div>

      <section className="card">
        <div className="card-header">
          <span className="card-title">Live Filters</span>
          <div className="filter-tools">
            <Funnel size={16} />
            <SlidersHorizontal size={16} />
          </div>
        </div>
        <div className="filters-grid">
          <label>
            <span>Status</span>
            <select
              className="field-input"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'All' | WorkOrderStatus)}
            >
              <option value="All">All statuses</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Overdue">Overdue</option>
              <option value="SLA Breach">SLA Breach</option>
              <option value="Pending Parts">Pending Parts</option>
            </select>
          </label>
          <label>
            <span>Priority</span>
            <select
              className="field-input"
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value as 'All' | Priority)}
            >
              <option value="All">All priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </label>
          <div className="filter-summary">
            <div className="text-caption">Search Scope</div>
            <div className="filter-summary-value">
              {searchQuery || 'Using global search bar for number, client, asset and technician lookups'}
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <span className="card-title">Operational Queue</span>
          <span className="text-caption">{filteredOrders.length} visible records</span>
        </div>
        <DataTable columns={columns} rows={filteredOrders} rowKey={(row) => row.id} />
      </section>

      <div className="mobile-card-grid">
        {filteredOrders.map((order) => (
          <Link key={order.id} href={`/work-orders/${order.id}`} className="card mobile-work-order-card">
            <div className="card-header">
              <span className="text-mono">{order.number}</span>
              <Badge tone={statusBadgeTone(order.status)}>{order.status}</Badge>
            </div>
            <div className="stack-list-title">{order.title}</div>
            <div className="stack-list-subtitle">
              {order.client} • {order.site}
            </div>
            <div className="card-chip-row">
              <Badge tone={priorityTone(order.priority)}>{order.priority}</Badge>
              <Badge tone={statusBadgeTone(order.slaState)}>{order.slaState}</Badge>
            </div>
          </Link>
        ))}
      </div>
    </>
  )
}
