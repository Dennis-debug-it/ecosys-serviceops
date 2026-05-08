import type { HTMLAttributes } from "react";
import { cn } from "@/services/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("soft-card rounded-[26px]", className)} {...props} />;
}
