import type { ReactNode } from 'react'
import { Badge } from '../../../components/ui/Badge'
import type { EmailIntakeMetric, IntakeStatusBadge } from './emailIntakeModels'
import { EmailIntakeMetricCards } from './EmailIntakeMetricCards'
import { EmailIntakeSubNav } from './EmailIntakeSubNav'
import type { EmailIntakeSectionId } from './emailIntakeModels'

function toneFromStatus(status: IntakeStatusBadge): 'success' | 'danger' | 'warning' {
  if (status === 'Enabled') return 'success'
  if (status === 'Disabled') return 'danger'
  return 'warning'
}

export function EmailIntakeLayout({
  status,
  metrics,
  activeSection,
  onSectionChange,
  onRunSync,
  onOpenSimulation,
  onOpenManualReview,
  onOpenMailbox,
  children,
}: {
  status: IntakeStatusBadge
  metrics: EmailIntakeMetric[]
  activeSection: EmailIntakeSectionId
  onSectionChange: (section: EmailIntakeSectionId) => void
  onRunSync: () => void
  onOpenSimulation: () => void
  onOpenManualReview: () => void
  onOpenMailbox: () => void
  children: ReactNode
}) {
  return (
    <div data-testid="email-intake-page" className="space-y-5">
      <section data-testid="email-intake-header" className="surface-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-app">Email Intake</h1>
            <p className="mt-2 text-sm text-muted">Convert incoming service emails into structured work orders.</p>
            <div className="mt-3" data-testid="email-intake-status-badge">
              <Badge tone={toneFromStatus(status)}>{status}</Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="button-secondary" onClick={onRunSync}>Run Sync</button>
            <button data-testid="email-intake-simulate-button" type="button" className="button-secondary" onClick={onOpenSimulation}>Simulate Email</button>
            <button type="button" className="button-secondary" onClick={onOpenManualReview}>View Manual Review</button>
            <button type="button" className="button-secondary" onClick={onOpenMailbox}>Settings</button>
          </div>
        </div>
      </section>

      <EmailIntakeMetricCards metrics={metrics} />

      <div className="grid gap-5 md:grid-cols-[280px_1fr]">
        <EmailIntakeSubNav activeSection={activeSection} onChange={onSectionChange} />
        <div>{children}</div>
      </div>
    </div>
  )
}
