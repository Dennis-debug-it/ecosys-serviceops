import type { ReactNode } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ServiceOpsShell } from "@/components/layout/serviceops-shell";

export default function ServiceOpsLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard allowedRoles={["Admin", "User"]}>
      <ServiceOpsShell>{children}</ServiceOpsShell>
    </AuthGuard>
  );
}
