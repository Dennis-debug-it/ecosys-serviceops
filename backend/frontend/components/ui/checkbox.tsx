import type { InputHTMLAttributes } from "react";
import { cn } from "@/services/utils";

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  description?: string;
}

export function Checkbox({ className, label, description, ...props }: CheckboxProps) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
      <input
        type="checkbox"
        className={cn(
          "mt-1 h-4 w-4 rounded border-slate-300 text-[color:var(--tenant-primary)] focus:ring-[color:var(--tenant-primary)]",
          className,
        )}
        {...props}
      />
      <span>
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
        {description ? <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span> : null}
      </span>
    </label>
  );
}
