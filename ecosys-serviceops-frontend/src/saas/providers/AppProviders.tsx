'use client'

import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useServiceOpsStore } from '@/store/useServiceOpsStore'

export function AppProviders({ children }: { children: ReactNode }) {
  const theme = useServiceOpsStore((state) => state.theme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return children
}
