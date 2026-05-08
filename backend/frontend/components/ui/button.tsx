import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/services/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[color:var(--tenant-primary)] text-white shadow-tenant hover:-translate-y-0.5 hover:bg-[color:var(--tenant-primary)]/92",
  secondary:
    "bg-[color:var(--tenant-secondary)] text-slate-950 hover:-translate-y-0.5 hover:bg-[color:var(--tenant-secondary)]/90",
  ghost:
    "border border-slate-200 bg-white/80 text-slate-700 hover:-translate-y-0.5 hover:border-[color:var(--tenant-primary)]/30 hover:text-[color:var(--tenant-primary)]",
  danger:
    "bg-rose-600 text-white hover:-translate-y-0.5 hover:bg-rose-700",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-10 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold outline-none disabled:cursor-not-allowed disabled:opacity-55",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
});
