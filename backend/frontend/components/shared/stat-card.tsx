import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
}

export function StatCard({ label, value, detail, icon }: StatCardProps) {
  return (
    <Card className="rounded-[28px] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="display-font mt-3 text-3xl font-semibold text-slate-900">{value}</p>
          <p className="mt-2 text-sm text-slate-600">{detail}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--tenant-primary)]/10 text-[color:var(--tenant-primary)]">
          {icon}
        </div>
      </div>
    </Card>
  );
}
