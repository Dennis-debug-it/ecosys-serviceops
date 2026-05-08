"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  LayoutDashboard,
  Menu,
  Settings,
  ShieldCheck,
  UserCog,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/services/auth-service";
import { cn, initials } from "@/services/utils";
import { useAccess } from "@/hooks/use-access";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";

interface ServiceOpsShellProps {
  children: ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  visible: boolean;
}

export function ServiceOpsShell({ children }: ServiceOpsShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const tenant = useAuthStore((state) => state.tenant);
  const branches = useAuthStore((state) => state.branches);
  const activeBranchId = useAuthStore((state) => state.activeBranchId);
  const setActiveBranchId = useAuthStore((state) => state.setActiveBranchId);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const access = useAccess();

  const items: NavItem[] = [
    { href: "/serviceops/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5" />, visible: true },
    { href: "/serviceops/workorders", label: "Work Orders", icon: <ClipboardList className="h-5 w-5" />, visible: access.canViewWorkOrders },
    { href: "/serviceops/assets", label: "Assets", icon: <Building2 className="h-5 w-5" />, visible: true },
    { href: "/serviceops/materials", label: "Materials", icon: <Boxes className="h-5 w-5" />, visible: true },
    { href: "/serviceops/pm", label: "Preventive Maintenance", icon: <Wrench className="h-5 w-5" />, visible: true },
    { href: "/serviceops/reports", label: "Reports", icon: <BarChart3 className="h-5 w-5" />, visible: access.canViewReports || access.isAdmin },
    { href: "/serviceops/users", label: "Users", icon: <UserCog className="h-5 w-5" />, visible: access.isAdmin },
    { href: "/serviceops/settings", label: "Settings", icon: <Settings className="h-5 w-5" />, visible: access.canManageSettings || access.isAdmin },
  ];

  const availableBranches = branches.filter((branch) => branch.isActive);
  const canSeeAllBranches = user?.role === "Admin" || user?.hasAllBranchAccess;

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch {
      toast.warning("Signed out locally. The backend session will settle on the next request.");
    } finally {
      clearAuth();
      router.replace("/login");
    }
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-lg font-bold text-white">
            {initials(tenant?.companyName)}
          </div>
          <div>
            <p className="display-font text-lg font-semibold text-white">Ecosys</p>
            <p className="text-xs text-emerald-100/80">ServiceOps</p>
          </div>
        </Link>
        <button
          type="button"
          className="rounded-full border border-white/10 p-2 text-white md:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="scrollbar-thin flex-1 space-y-1 overflow-y-auto px-3 py-5">
        {items
          .filter((item) => item.visible)
          .map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition hover:bg-white/10",
                  active ? "bg-white text-slate-950 shadow-lg" : "text-emerald-50/92",
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
      </div>
      <div className="border-t border-white/10 px-4 py-4">
        <div className="rounded-2xl bg-white/10 p-4 text-white/92">
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-100/75">Branch scope</p>
          <p className="mt-2 text-sm leading-6 text-emerald-50/90">
            Switch branches from the top bar to keep work orders, stock, and reporting branch-aware.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen md:grid md:grid-cols-[290px_minmax(0,1fr)]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[290px] -translate-x-full bg-[linear-gradient(180deg,#164d39,#0f3025)] transition-transform md:sticky md:translate-x-0",
          sidebarOpen && "translate-x-0",
        )}
      >
        {sidebar}
      </aside>

      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-slate-950/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      ) : null}

      <main className="relative min-w-0">
        <div className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/72 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3 px-4 py-4 md:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-2xl border border-slate-200 bg-white/80 p-3 text-slate-700 md:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--tenant-primary)]">
                  {tenant?.companyName ?? "Tenant workspace"}
                </p>
                <h1 className="display-font text-lg font-semibold text-slate-900">
                  {availableBranches.find((branch) => branch.id === activeBranchId)?.name ??
                    (canSeeAllBranches ? "All branches" : "All assigned branches")}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden min-w-[220px] md:block">
                <Select
                  aria-label="Active branch"
                  value={activeBranchId ?? ""}
                  onChange={(event) => setActiveBranchId(event.target.value || null)}
                >
                  <option value="">{canSeeAllBranches ? "All branches" : "All assigned branches"}</option>
                  {availableBranches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.code} - {branch.name}
                    </option>
                  ))}
                </Select>
              </div>

              <Card className="hidden rounded-2xl px-4 py-2 md:block">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Role</p>
                <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <ShieldCheck className="h-4 w-4 text-[color:var(--tenant-primary)]" />
                  {user?.role ?? "User"}
                </div>
              </Card>

              <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white/85 px-2 py-2 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--tenant-primary)] text-sm font-bold text-white">
                  {initials(user?.fullName)}
                </div>
                <div className="hidden pr-1 md:block">
                  <p className="text-sm font-semibold text-slate-900">{user?.fullName ?? "User"}</p>
                  <p className="text-xs text-slate-500">{user?.jobTitle ?? user?.email}</p>
                </div>
                <Button variant="ghost" size="sm" className="rounded-full" onClick={handleLogout}>
                  Sign out
                </Button>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200/70 px-4 py-3 md:hidden">
            <Select
              aria-label="Active branch"
              value={activeBranchId ?? ""}
              onChange={(event) => setActiveBranchId(event.target.value || null)}
            >
              <option value="">{canSeeAllBranches ? "All branches" : "All assigned branches"}</option>
              {availableBranches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.code} - {branch.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>
    </div>
  );
}
