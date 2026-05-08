import type { ReactNode } from 'react'

type BadgeTone = 'open' | 'progress' | 'done' | 'overdue' | 'breach' | 'pending'

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}
