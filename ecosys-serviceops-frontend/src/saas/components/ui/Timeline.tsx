import type { TimelineStep } from '@/saas/types'

export function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div className="timeline">
      {steps.map((step) => (
        <div key={step.id} className="timeline-step">
          <div className={`timeline-dot ${step.status === 'done' ? 'done' : step.status === 'active' ? 'active' : ''}`} />
          <div className="timeline-label">{step.label}</div>
          <div className="timeline-time">{step.time}</div>
        </div>
      ))}
    </div>
  )
}
