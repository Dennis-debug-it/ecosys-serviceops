"use client";

import { useEffect } from "react";
import { normalizeHexColor } from "@/services/utils";
import { useAuthStore } from "@/store/auth-store";

export function ThemeSync() {
  const tenant = useAuthStore((state) => state.tenant);

  useEffect(() => {
    const root = document.documentElement;

    root.style.setProperty("--tenant-primary", normalizeHexColor(tenant?.primaryColor, "#1d6b4d"));
    root.style.setProperty("--tenant-secondary", normalizeHexColor(tenant?.secondaryColor, "#d9a516"));
  }, [tenant?.primaryColor, tenant?.secondaryColor]);

  return null;
}
