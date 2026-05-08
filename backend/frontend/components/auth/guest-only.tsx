"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { PageLoader } from "@/components/shared/page-loader";
import { useAuthStore } from "@/store/auth-store";

interface GuestOnlyProps {
  children: ReactNode;
}

export function GuestOnly({ children }: GuestOnlyProps) {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const bootstrapped = useAuthStore((state) => state.bootstrapped);

  useEffect(() => {
    if (!hasHydrated || !bootstrapped) {
      return;
    }

    if (token) {
      router.replace("/dashboard");
    }
  }, [bootstrapped, hasHydrated, router, token]);

  if (!hasHydrated || !bootstrapped) {
    return <PageLoader label="Loading sign-in..." />;
  }

  if (token) {
    return <PageLoader label="Taking you back to your workspace..." />;
  }

  return <>{children}</>;
}
