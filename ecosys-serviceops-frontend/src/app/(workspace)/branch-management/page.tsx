'use client'

import { Building2, MapPinned, Signal, UsersRound } from 'lucide-react'
import { PageHeader } from '@/saas/components/shared/PageHeader'
import { Badge } from '@/saas/components/ui/Badge'
import { DataTable } from '@/saas/components/ui/DataTable'
import { useServiceOpsStore } from '@/store/useServiceOpsStore'
import { getBreadcrumbs, statusBadgeTone } from '@/saas/utils/formatters'
import type { BranchRecord } from '@/saas/types'

export default function BranchManagementPage() {
  const branches = useServiceOpsStore((state) => state.branches)

  const columns = [
    {
      key: 'name',
      header: 'Branch',
      render: (row: BranchRecord) => (
        <div>
          <div className="stack-list-title">{row.name}</div>
          <div className="stack-list-subtitle">{row.region}</div>
        </div>
      ),
    },
    {
      key: 'technicians',
      header: 'Technicians',
      render: (row: BranchRecord) => row.technicians,
    },
    {
      key: 'open',
      header: 'Open WOs',
      render: (row: BranchRecord) => row.openWorkOrders,
    },
    {
      key: 'assets',
      header: 'Assets',
      render: (row: BranchRecord) => row.assets,
    },
    {
      key: 'sla',
      header: 'SLA Score',
      render: (row: BranchRecord) => (
        <Badge tone={statusBadgeTone(row.slaScore >= 90 ? 'Healthy' : row.slaScore >= 85 ? 'Near Limit' : 'Attention')}>
          {row.slaScore}%
        </Badge>
      ),
    },
  ]

  const totalOpen = branches.reduce((total, branch) => total + branch.openWorkOrders, 0)
  const totalAssets = branches.reduce((total, branch) => total + branch.assets, 0)
  const averageSla = Math.round(branches.reduce((total, branch) => total + branch.slaScore, 0) / branches.length)

  return (
    <>
      <PageHeader
        breadcrumbs={getBreadcrumbs('/branch-management')}
        title="Branch Management"
        description="Branch performance, workload distribution and SLA posture across the tenant footprint."
      />

      <div className="grid-4">
        <div className="metric-card">
          <Building2 size={18} />
          <div className="summary-value">{branches.length}</div>
          <div className="summary-note">Live branches</div>
        </div>
        <div className="metric-card">
          <UsersRound size={18} />
          <div className="summary-value">{branches.reduce((total, branch) => total + branch.technicians, 0)}</div>
          <div className="summary-note">Technicians deployed</div>
        </div>
        <div className="metric-card">
          <MapPinned size={18} />
          <div className="summary-value">{totalAssets}</div>
          <div className="summary-note">Assets under cover</div>
        </div>
        <div className="metric-card">
          <Signal size={18} />
          <div className="summary-value">{averageSla}%</div>
          <div className="summary-note">Average SLA score</div>
        </div>
      </div>

      <section className="card">
        <div className="card-header">
          <span className="card-title">Regional Operations Matrix</span>
          <span className="text-caption">{totalOpen} open work orders across branches</span>
        </div>
        <DataTable columns={columns} rows={branches} rowKey={(row) => row.id} />
      </section>
    </>
  )
}
