"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Boxes, CheckCircle2, ClipboardList, GitBranch, Users2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { dashboardService } from "@/services/dashboard-service";
import { getApiErrorMessage } from "@/services/api-client";
import { formatNumber } from "@/services/utils";
import { useAuthStore } from "@/store/auth-store";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorPanel } from "@/components/shared/error-panel";

const statusChartColors = ["#1d6b4d", "#d9a516", "#ef4444"];

export function SummaryPanel() {
  const activeBranchId = useAuthStore((state) => state.activeBranchId);

  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary", activeBranchId],
    queryFn: () => dashboardService.getSummary(activeBranchId),
  });

  if (summaryQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Operational dashboard"
          description="A branch-aware snapshot of work orders, stock pressure, and workforce activity."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="soft-card h-36 animate-pulse rounded-[28px] bg-white/65" />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="soft-card h-[360px] animate-pulse rounded-[28px] bg-white/65" />
          <div className="soft-card h-[360px] animate-pulse rounded-[28px] bg-white/65" />
        </div>
      </div>
    );
  }

  if (summaryQuery.isError || !summaryQuery.data) {
    return <ErrorPanel message={getApiErrorMessage(summaryQuery.error, "We could not load the dashboard summary.")} />;
  }

  const summary = summaryQuery.data;
  const hasBranchData = summary.workOrdersByBranch.length > 0;
  const statusSeries = [
    { name: "Open", value: summary.openWorkOrders },
    { name: "Completed", value: summary.completedWorkOrders },
    { name: "Overdue", value: summary.overdueWorkOrders },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational dashboard"
        description="A branch-aware snapshot of work orders, low stock exposure, and active users across your tenant."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open work orders"
          value={formatNumber(summary.openWorkOrders)}
          detail="Items that still need action from the field or dispatch team."
          icon={<ClipboardList className="h-6 w-6" />}
        />
        <StatCard
          label="Completed work orders"
          value={formatNumber(summary.completedWorkOrders)}
          detail="Resolved work in the current branch scope."
          icon={<CheckCircle2 className="h-6 w-6" />}
        />
        <StatCard
          label="Overdue work orders"
          value={formatNumber(summary.overdueWorkOrders)}
          detail="Jobs that have crossed their due date and need recovery."
          icon={<AlertTriangle className="h-6 w-6" />}
        />
        <StatCard
          label="Low stock items"
          value={formatNumber(summary.lowStockCount)}
          detail="Materials at or below reorder thresholds."
          icon={<Boxes className="h-6 w-6" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-[30px] p-5 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--tenant-primary)]">
                Status mix
              </p>
              <h2 className="display-font mt-2 text-2xl font-semibold text-slate-900">Work orders by status</h2>
            </div>
            <div className="rounded-2xl bg-[color:var(--tenant-primary)]/10 p-3 text-[color:var(--tenant-primary)]">
              <ClipboardList className="h-6 w-6" />
            </div>
          </div>

          <div className="mt-6 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusSeries}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={62}
                  outerRadius={98}
                  paddingAngle={4}
                />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {statusSeries.map((item, index) => (
              <div key={item.name} className="rounded-2xl border border-slate-200 bg-white/75 p-4">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: statusChartColors[index] }} />
                  <p className="text-sm font-semibold text-slate-700">{item.name}</p>
                </div>
                <p className="display-font mt-3 text-2xl font-semibold text-slate-900">{formatNumber(item.value)}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="rounded-[30px] p-5 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--tenant-primary)]">
                Branch load
              </p>
              <h2 className="display-font mt-2 text-2xl font-semibold text-slate-900">Work orders by branch</h2>
            </div>
            <div className="rounded-2xl bg-[color:var(--tenant-secondary)]/16 p-3 text-amber-700">
              <GitBranch className="h-6 w-6" />
            </div>
          </div>

          {hasBranchData ? (
            <div className="mt-6 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.workOrdersByBranch}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d7e1db" />
                  <XAxis dataKey="branchName" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1d6b4d" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-6">
              <EmptyState
                title="No branch volume yet"
                description="Work orders by branch will appear here as soon as the selected scope has branch activity."
              />
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="rounded-[28px] p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--tenant-primary)]">Branch footprint</p>
          <p className="display-font mt-3 text-3xl font-semibold text-slate-900">{formatNumber(summary.totalBranches)}</p>
          <p className="mt-2 text-sm text-slate-600">{formatNumber(summary.activeBranches)} active branches in your current tenant.</p>
        </Card>
        <Card className="rounded-[28px] p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--tenant-primary)]">Active users</p>
          <p className="display-font mt-3 text-3xl font-semibold text-slate-900">{formatNumber(summary.activeUsers)}</p>
          <p className="mt-2 text-sm text-slate-600">Visible users inside the branch scope you are currently viewing.</p>
        </Card>
        <Card className="rounded-[28px] p-5">
          <div className="flex items-center gap-2">
            <Users2 className="h-5 w-5 text-[color:var(--tenant-primary)]" />
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--tenant-primary)]">Stock pressure by branch</p>
          </div>
          <div className="mt-4 space-y-3">
            {summary.materialsLowStockByBranch.length > 0 ? (
              summary.materialsLowStockByBranch.slice(0, 4).map((item) => (
                <div key={`${item.branchId ?? item.branchName}`} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/70 px-4 py-3">
                  <div>
                    <p className="font-semibold text-slate-900">{item.branchName ?? "Unassigned branch"}</p>
                    <p className="text-xs text-slate-500">Low stock items</p>
                  </div>
                  <span className="display-font text-2xl font-semibold text-amber-700">{formatNumber(item.count)}</span>
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-slate-600">No branch is currently sitting below its reorder point.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
