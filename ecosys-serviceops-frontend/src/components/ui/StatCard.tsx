import type { LucideIcon } from 'lucide-react'

export function StatCard({
  title,
  value,
  detail,
  icon: Icon,
  accent = 'cyan',
}: {
  title: string
  value: string
  detail: string
  icon: LucideIcon
  accent?: 'cyan' | 'emerald' | 'amber' | 'rose'
}) {
  const accentClass =
    accent === 'emerald'
      ? 'icon-emerald'
      : accent === 'amber'
        ? 'icon-amber'
        : accent === 'rose'
          ? 'icon-rose'
          : 'icon-accent'

  return (
    <article className="surface-card flex min-h-[120px] flex-col justify-between">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-secondary text-xs font-semibold uppercase tracking-[0.2em]">{title}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-app">{value}</p>
        </div>
        <div className={`rounded-2xl p-3 ${accentClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-sm text-muted">{detail}</p>
    </article>
  )
}
