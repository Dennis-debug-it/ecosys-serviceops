"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AppRole } from "@/services/types";
import { useAuthStore } from "@/store/auth-store";
import { PageLoader } from "@/components/shared/page-loader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AuthGuardProps {
  children: ReactNode;
  allowedRoles?: AppRole[];
}

export function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const bootstrapped = useAuthStore((state) => state.bootstrapped);

  useEffect(() => {
    if (!hasHydrated || !bootstrapped) {
      return;
    }

    if (!token) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [bootstrapped, hasHydrated, pathname, router, token]);

  if (!hasHydrated || !bootstrapped) {
    return <PageLoader label="Syncing your tenant access..." />;
  }

  if (!token || !user) {
    return <PageLoader label="Redirecting to login..." />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <Card className="max-w-lg p-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[color:var(--tenant-primary)]">
            Access limited
          </p>
          <h1 className="display-font mt-3 text-3xl font-semibold text-slate-900">
            This area is not available for your role.
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {user.role === "SuperAdmin"
              ? "SuperAdmin access is reserved for platform-level experiences and does not open tenant operations."
              : "Your account can stay inside the modules and actions your tenant admin has enabled."}
          </p>
          <div className="mt-6 flex justify-center">
            <Button onClick={() => router.push("/dashboard")}>Back to dashboard</Button>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
