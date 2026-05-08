"use client";

import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Factory, ShieldEllipsis, Sparkles } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/hooks/use-access";
import { useAuthStore } from "@/store/auth-store";

const cards = [
  {
    title: "ServiceOps",
    description: "Work orders, branch-aware stores, field teams, assets, and operational settings in one flow.",
    href: "/serviceops",
    icon: BriefcaseBusiness,
    active: true,
  },
  {
    title: "Command Centre",
    description: "Platform oversight, tenant health, and active-session intelligence for the wider Ecosys estate.",
    href: "#",
    icon: ShieldEllipsis,
    active: false,
  },
  {
    title: "Factory Intelligence",
    description: "Production telemetry, quality trends, and machine performance are prepared for future rollout.",
    href: "#",
    icon: Factory,
    active: false,
  },
];

export function ModuleSelector() {
  const access = useAccess();
  const tenant = useAuthStore((state) => state.tenant);

  return (
    <AuthGuard>
      <div className="min-h-screen px-4 py-8 md:px-6 md:py-10">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col justify-center">
          <div className="glass-panel rounded-[34px] px-6 py-8 md:px-10 md:py-12">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-[color:var(--tenant-primary)]/10 px-4 py-2 text-sm font-semibold text-[color:var(--tenant-primary)]">
                  <Sparkles className="h-4 w-4" />
                  Ecosys workspace
                </div>
                <h1 className="display-font mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
                  Choose the module that fits the work your team is doing right now.
                </h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
                  {tenant?.companyName ?? "Your tenant"} is signed in. ServiceOps is live today, while the rest of the
                  platform is staged so the product can expand without rewriting the shell later.
                </p>
              </div>
              <Card className="rounded-[28px] px-5 py-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Signed in as</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{access.user?.fullName}</p>
                <p className="text-sm text-slate-500">
                  {access.user?.role}
                  {access.user?.jobTitle ? ` • ${access.user.jobTitle}` : ""}
                </p>
              </Card>
            </div>

            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {cards.map((card) => {
                const Icon = card.icon;
                const disabledForRole = access.isSuperAdmin && card.title === "ServiceOps";

                return (
                  <Card
                    key={card.title}
                    className="group flex h-full flex-col rounded-[30px] p-6 md:p-7"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--tenant-primary)]/10 text-[color:var(--tenant-primary)]">
                        <Icon className="h-7 w-7" />
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          card.active ? "bg-emerald-600/10 text-emerald-700" : "bg-slate-900/6 text-slate-500"
                        }`}
                      >
                        {card.active ? "Active" : "Coming soon"}
                      </span>
                    </div>

                    <h2 className="display-font mt-5 text-2xl font-semibold text-slate-900">{card.title}</h2>
                    <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{card.description}</p>

                    {card.active && !disabledForRole ? (
                      <Link href={card.href} className="mt-6">
                        <Button className="w-full justify-between">
                          Open module
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        className="mt-6 w-full justify-between"
                        variant="ghost"
                        disabled
                      >
                        {disabledForRole ? "SuperAdmin uses platform views" : "Available in a later release"}
                      </Button>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
