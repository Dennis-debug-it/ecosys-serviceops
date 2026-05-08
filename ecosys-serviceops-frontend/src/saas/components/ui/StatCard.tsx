import { trendSymbol } from '@/saas/utils/formatters'
import type { DashboardStat } from '@/saas/types'

export function StatCard({ stat, delayClass = '' }: { stat: DashboardStat; delayClass?: string }) {
  const trendToneClass =
    stat.trendDirection === 'up'
      ? 'trend-up'
      : stat.trendDirection === 'down'
        ? 'trend-down'
        : ''

  return (
    <article className={`stat-card ${stat.tone} animate-in ${delayClass}`}>
      <div className="stat-label">{stat.label}</div>
      <div className="stat-value">{stat.value}</div>
      <div className={`stat-trend ${trendToneClass}`}>
        <span>{trendSymbol(stat.trendDirection)}</span>
        <span>{stat.trendLabel}</span>
      </div>
    </article>
  )
}
