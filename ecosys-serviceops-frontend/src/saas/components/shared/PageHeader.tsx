import type { ReactNode } from 'react'
import Link from 'next/link'
import type { BreadcrumbItem } from '@/saas/types'

export function PageHeader({
  breadcrumbs,
  title,
  description,
  actions,
}: {
  breadcrumbs: BreadcrumbItem[]
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <div className="page-header animate-in">
      <div className="page-title-group">
        <div className="breadcrumb">
          {breadcrumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`}>
              {index > 0 ? <span>/</span> : null}{' '}
              {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span className="breadcrumb-current">{crumb.label}</span>}
            </span>
          ))}
        </div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </div>
  )
}
