import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/services/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-2xl border border-slate-200 bg-white/90 px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[color:var(--tenant-primary)] focus:ring-4 focus:ring-[color:var(--tenant-primary)]/10",
        className,
      )}
      {...props}
    />
  );
});
