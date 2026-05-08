"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ServiceOpsIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/serviceops/dashboard");
  }, [router]);

  return null;
}
