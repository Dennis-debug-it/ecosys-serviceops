import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import { AppProviders } from '@/saas/providers/AppProviders'

export const metadata: Metadata = {
  title: 'Ecosys ServiceOps',
  description: 'Premium ServiceOps SaaS workspace for field operations teams.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
