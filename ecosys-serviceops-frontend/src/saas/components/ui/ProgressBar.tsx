export function ProgressBar({
  value,
  tone,
}: {
  value: number
  tone: 'primary' | 'emerald' | 'amber' | 'rose'
}) {
  return (
    <div className="progress-bar" aria-hidden="true">
      <div className={`progress-fill ${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}
