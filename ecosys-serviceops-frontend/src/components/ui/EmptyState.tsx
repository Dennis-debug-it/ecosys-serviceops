import { Sparkles } from 'lucide-react'

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="surface-card flex min-h-[220px] flex-col items-center justify-center text-center">
      <div className="icon-accent rounded-2xl p-4">
        <Sparkles className="h-6 w-6" />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-app">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted">{description}</p>
      {actionLabel && onAction ? (
        <button type="button" className="button-secondary mt-5" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}
