import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/services/utils";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-28 w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[color:var(--tenant-primary)] focus:ring-4 focus:ring-[color:var(--tenant-primary)]/10",
        className,
      )}
      {...props}
    />
  );
});
