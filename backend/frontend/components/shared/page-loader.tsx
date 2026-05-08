import { LoaderCircle } from "lucide-react";

interface PageLoaderProps {
  label: string;
}

export function PageLoader({ label }: PageLoaderProps) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="glass-panel flex w-full max-w-md flex-col items-center rounded-[28px] px-8 py-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--tenant-primary)]/12 text-[color:var(--tenant-primary)] shadow-tenant">
          <LoaderCircle className="h-7 w-7 animate-spin" />
        </div>
        <p className="display-font mt-5 text-2xl font-semibold text-slate-900">Ecosys is getting things ready</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">{label}</p>
      </div>
    </div>
  );
}
