'use client'

import { Activity, CloudOff, ShieldCheck, Wrench } from 'lucide-react'
import { PageHeader } from '@/saas/components/shared/PageHeader'
import { Badge } from '@/saas/components/ui/Badge'
import { DataTable } from '@/saas/components/ui/DataTable'
import { useServiceOpsStore } from '@/store/useServiceOpsStore'
import { getBreadcrumbs, statusBadgeTone } from '@/saas/utils/formatters'
import type { Asset } from '@/saas/types'

export default function AssetsPage() {
  const assets = useServiceOpsStore((state) => state.assets)

  const columns = [
    {
      key: 'code',
      header: 'Asset Code',
      render: (row: Asset) => <span className="text-mono">{row.code}</span>,
    },
    {
      key: 'name',
      header: 'Asset',
      render: (row: Asset) => (
        <div>
          <div className="stack-list-title">{row.name}</div>
          <div className="stack-list-subtitle">{row.category}</div>
        </div>
      ),
    },
    {
      key: 'client',
      header: 'Client / Site',
      render: (row: Asset) => `${row.client} • ${row.site}`,
    },
    {
      key: 'health',
      header: 'Health',
      render: (row: Asset) => (
        <Badge
          tone={statusBadgeTone(
            row.health === 'Maintenance Due'
              ? 'Due Today'
              : row.health === 'Operational'
                ? 'Healthy'
                : row.health === 'Offline'
                  ? 'Attention'
                  : 'Near Limit',
          )}
        >
          {row.health}
        </Badge>
      ),
    },
    {
      key: 'nextPm',
      header: 'Next PM',
      render: (row: Asset) => row.nextPm,
    },
    {
      key: 'uptime',
      header: 'Uptime',
      render: (row: Asset) => row.uptime,
    },
  ]

  return (
    <>
      <PageHeader
        breadcrumbs={getBreadcrumbs('/assets')}
        title="Assets"
        description="Premium asset register with live health posture, maintenance windows and branch coverage."
      />

      <div className="grid-4">
        <div className="metric-card">
          <ShieldCheck size={18} />
          <div className="summary-value">{assets.length}</div>
          <div className="summary-note">Tracked assets</div>
        </div>
        <div className="metric-card">
          <Activity size={18} />
          <div className="summary-value">{assets.filter((asset) => asset.health === 'Degraded').length}</div>
          <div className="summary-note">Degraded performance</div>
        </div>
        <div className="metric-card">
          <Wrench size={18} />
          <div className="summary-value">{assets.filter((asset) => asset.health === 'Maintenance Due').length}</div>
          <div className="summary-note">Maintenance due</div>
        </div>
        <div className="metric-card">
          <CloudOff size={18} />
          <div className="summary-value">{assets.filter((asset) => asset.health === 'Offline').length}</div>
          <div className="summary-note">Offline assets</div>
        </div>
      </div>

      <section className="card">
        <div className="card-header">
          <span className="card-title">Asset Register</span>
          <span className="text-caption">Branch-sorted operational inventory</span>
        </div>
        <DataTable columns={columns} rows={assets} rowKey={(row) => row.id} />
      </section>
    </>
  )
}
