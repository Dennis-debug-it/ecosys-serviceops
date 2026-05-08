import { Card } from "@/components/ui/card";

interface ShellPlaceholderProps {
  title: string;
  description: string;
}

export function ShellPlaceholder({ title, description }: ShellPlaceholderProps) {
  return (
    <Card className="rounded-[28px] p-6 md:p-8">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[color:var(--tenant-primary)]">Ready for next iteration</p>
      <h2 className="display-font mt-3 text-3xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">{description}</p>
    </Card>
  );
}
