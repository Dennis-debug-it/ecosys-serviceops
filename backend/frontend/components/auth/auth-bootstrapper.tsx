"use client";

import { useEffect } from "react";
import { authService } from "@/services/auth-service";
import { useAuthStore } from "@/store/auth-store";

export function AuthBootstrapper() {
  const token = useAuthStore((state) => state.token);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const bootstrapped = useAuthStore((state) => state.bootstrapped);
  const setAuthenticatedContext = useAuthStore((state) => state.setAuthenticatedContext);
  const setBootstrapped = useAuthStore((state) => state.setBootstrapped);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    if (!token) {
      setBootstrapped(true);
      return;
    }

    if (bootstrapped) {
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      try {
        const context = await authService.getCurrentContext();

        if (!cancelled) {
          setAuthenticatedContext(context);
        }
      } catch {
        if (!cancelled) {
          clearAuth();
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [bootstrapped, clearAuth, hasHydrated, setAuthenticatedContext, setBootstrapped, token]);

  return null;
}
