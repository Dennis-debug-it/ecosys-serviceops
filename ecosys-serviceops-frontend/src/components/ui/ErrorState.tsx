import { AlertTriangle } from 'lucide-react'

export function ErrorState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="surface-card border border-rose-400/20 bg-rose-500/5">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-rose-500/10 p-3 text-rose-200">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-app">{title}</h3>
          <p className="mt-2 text-sm text-muted">{description}</p>
        </div>
      </div>
    </div>
  )
}
