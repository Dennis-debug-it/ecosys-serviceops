import { AlertTriangle } from 'lucide-react'

export function ErrorState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="surface-card border border-[var(--app-badge-danger-border)] bg-[var(--app-badge-danger-bg)]">
      <div className="flex items-start gap-4">
        <div className="rounded-[14px] bg-[var(--app-badge-danger-bg)] p-3 text-[var(--app-badge-danger-text)]">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-heading text-lg font-semibold text-app">{title}</h3>
          <p className="mt-2 text-sm text-muted">{description}</p>
        </div>
      </div>
    </div>
  )
}
