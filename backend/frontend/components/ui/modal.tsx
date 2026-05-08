import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/services/utils";

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, title, description, onClose, children, className }: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/38 p-3 md:items-center md:p-6">
      <div className={cn("glass-panel max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[30px]", className)}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 px-5 py-4 md:px-6">
          <div>
            <h2 className="display-font text-2xl font-semibold text-slate-900">{title}</h2>
            {description ? <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white/80 p-2 text-slate-500 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="scrollbar-thin max-h-[calc(90vh-5.5rem)] overflow-y-auto px-5 py-5 md:px-6">{children}</div>
      </div>
    </div>
  );
}
