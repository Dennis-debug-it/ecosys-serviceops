import type { HTMLAttributes } from "react";
import { cn } from "@/services/utils";

type BadgeTone = "neutral" | "success" | "warning" | "danger";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-slate-900/6 text-slate-700",
  success: "bg-emerald-600/10 text-emerald-700",
  warning: "bg-amber-500/14 text-amber-800",
  danger: "bg-rose-600/10 text-rose-700",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
