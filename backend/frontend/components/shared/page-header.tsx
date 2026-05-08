import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[color:var(--tenant-primary)]">ServiceOps</p>
        <h1 className="display-font mt-2 text-3xl font-semibold text-slate-900 md:text-[2.15rem]">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
