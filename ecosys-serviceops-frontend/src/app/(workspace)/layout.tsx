import type { ReactNode } from 'react'
import { AppShell } from '@/saas/components/layout/AppShell'

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>
}
