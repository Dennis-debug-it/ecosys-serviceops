"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageLoader } from "@/components/shared/page-loader";
import { useAuthStore } from "@/store/auth-store";

export default function HomePage() {
  const router = useRouter();
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const bootstrapped = useAuthStore((state) => state.bootstrapped);
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    if (!hasHydrated || !bootstrapped) {
      return;
    }

    router.replace(token ? "/dashboard" : "/login");
  }, [bootstrapped, hasHydrated, router, token]);

  return <PageLoader label="Preparing your Ecosys workspace..." />;
}
