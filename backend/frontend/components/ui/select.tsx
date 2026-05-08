import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/services/utils";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        "h-11 w-full rounded-2xl border border-slate-200 bg-white/90 px-4 text-sm text-slate-900 outline-none focus:border-[color:var(--tenant-primary)] focus:ring-4 focus:ring-[color:var(--tenant-primary)]/10",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});
