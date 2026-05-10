import type { ReactNode } from 'react'

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="eyebrow-accent text-xs font-semibold uppercase tracking-[0.18em]">{eyebrow}</p>
        ) : null}
        <h1 className="mt-2 font-heading text-[2rem] font-semibold tracking-[-0.03em] text-app sm:text-[2.5rem]">{title}</h1>
        <p className="mt-3 max-w-3xl text-[0.95rem] leading-7 text-muted">{description}</p>
      </div>
      {actions ? <div className="flex w-full flex-wrap items-stretch gap-3 lg:w-auto lg:items-center">{actions}</div> : null}
    </div>
  )
}
