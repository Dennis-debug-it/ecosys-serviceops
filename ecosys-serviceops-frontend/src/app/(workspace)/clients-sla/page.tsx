'use client'

import { BriefcaseBusiness, Clock3, Shield, Siren } from 'lucide-react'
import { PageHeader } from '@/saas/components/shared/PageHeader'
import { Badge } from '@/saas/components/ui/Badge'
import { DataTable } from '@/saas/components/ui/DataTable'
import { ProgressBar } from '@/saas/components/ui/ProgressBar'
import { useServiceOpsStore } from '@/store/useServiceOpsStore'
import { getBreadcrumbs, statusBadgeTone } from '@/saas/utils/formatters'
import type { ClientSla } from '@/saas/types'

export default function ClientsSlaPage() {
  const clientSlas = useServiceOpsStore((state) => state.clientSlas)
  const slaMetrics = useServiceOpsStore((state) => state.slaMetrics)

  const columns = [
    {
      key: 'client',
      header: 'Client',
      render: (row: ClientSla) => row.client,
    },
    {
      key: 'branch',
      header: 'Branch',
      render: (row: ClientSla) => row.branch,
    },
    {
      key: 'sites',
      header: 'Sites',
      render: (row: ClientSla) => row.sites,
    },
    {
      key: 'tier',
      header: 'SLA Tier',
      render: (row: ClientSla) => (
        <Badge
          tone={statusBadgeTone(
            row.slaTier === 'Platinum' ? 'Healthy' : row.slaTier === 'Gold' ? 'Near Limit' : 'Scheduled',
          )}
        >
          {row.slaTier}
        </Badge>
      ),
    },
    {
      key: 'response',
      header: 'Response',
      render: (row: ClientSla) => row.responseTarget,
    },
    {
      key: 'resolution',
      header: 'Resolution',
      render: (row: ClientSla) => row.resolutionTarget,
    },
    {
      key: 'incidents',
      header: 'Active Incidents',
      render: (row: ClientSla) => row.activeIncidents,
    },
  ]

  return (
    <>
      <PageHeader
        breadcrumbs={getBreadcrumbs('/clients-sla')}
        title="Clients & SLA"
        description="Client portfolio, service commitments and response health in one premium operations view."
      />

      <div className="grid-4">
        <div className="metric-card">
          <BriefcaseBusiness size={18} />
          <div className="summary-value">{clientSlas.length}</div>
          <div className="summary-note">Active client portfolios</div>
        </div>
        <div className="metric-card">
          <Shield size={18} />
          <div className="summary-value">{clientSlas.filter((client) => client.slaTier === 'Platinum').length}</div>
          <div className="summary-note">Platinum SLAs</div>
        </div>
        <div className="metric-card">
          <Clock3 size={18} />
          <div className="summary-value">{clientSlas.reduce((total, client) => total + client.activeIncidents, 0)}</div>
          <div className="summary-note">Active incidents</div>
        </div>
        <div className="metric-card">
          <Siren size={18} />
          <div className="summary-value">{slaMetrics[0]?.value ?? 0}%</div>
          <div className="summary-note">Response compliance</div>
        </div>
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-header">
            <span className="card-title">Client SLA Matrix</span>
            <span className="text-caption">Service terms and live obligations</span>
          </div>
          <DataTable columns={columns} rows={clientSlas} rowKey={(row) => row.id} />
        </section>

        <section className="card">
          <div className="card-header">
            <span className="card-title">SLA Health Snapshot</span>
            <Badge tone="open">Live</Badge>
          </div>
          <div className="metric-stack">
            {slaMetrics.map((metric) => (
              <div key={metric.id} className="metric-block">
                <div className="metric-line">
                  <span>{metric.label}</span>
                  <span>{metric.value}%</span>
                </div>
                <ProgressBar value={metric.value} tone={metric.tone} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
