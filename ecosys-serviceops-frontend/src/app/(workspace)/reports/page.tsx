'use client'

import { Download, FileSpreadsheet, FileText, Filter } from 'lucide-react'
import { PageHeader } from '@/saas/components/shared/PageHeader'
import { useServiceOpsStore } from '@/store/useServiceOpsStore'
import { getBreadcrumbs } from '@/saas/utils/formatters'

export default function ReportsPage() {
  const reports = useServiceOpsStore((state) => state.reports)

  return (
    <>
      <PageHeader
        breadcrumbs={getBreadcrumbs('/reports')}
        title="Reports"
        description="Executive-ready performance summaries for service delivery, SLA adherence and materials exposure."
        actions={
          <>
            <button type="button" className="btn btn-secondary">
              <Download size={16} /> CSV
            </button>
            <button type="button" className="btn btn-secondary">
              <FileSpreadsheet size={16} /> Excel
            </button>
            <button type="button" className="btn btn-primary">
              <FileText size={16} /> PDF
            </button>
          </>
        }
      />

      <section className="card">
        <div className="card-header">
          <span className="card-title">Report Filters</span>
          <span className="filter-tools">
            <Filter size={16} />
          </span>
        </div>
        <div className="card-chip-row">
          <span className="filter-pill active">Last 30 days</span>
          <span className="filter-pill">All branches</span>
          <span className="filter-pill">All clients</span>
          <span className="filter-pill">Operational status</span>
        </div>
      </section>

      <div className="grid-2">
        {reports.map((report) => (
          <section key={report.id} className="report-card">
            <div className="card-header">
              <span className="card-title">{report.title}</span>
              <span className="report-trend">{report.trend}</span>
            </div>
            <div className="report-metric">{report.metric}</div>
            <p className="summary-note">{report.detail}</p>
          </section>
        ))}
      </div>
    </>
  )
}
