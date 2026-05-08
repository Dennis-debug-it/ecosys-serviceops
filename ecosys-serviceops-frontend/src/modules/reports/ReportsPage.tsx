import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyReportsState } from './EmptyReportsState'

export function ReportsPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Reports"
        title="Reports"
        description="Review operational summaries and service performance across your workspace."
      />
      <EmptyReportsState />
    </div>
  )
}
