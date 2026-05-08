import type { ReactNode } from 'react'

export default function WorkspaceTemplate({ children }: { children: ReactNode }) {
  return <div className="page-transition animate-in">{children}</div>
}
