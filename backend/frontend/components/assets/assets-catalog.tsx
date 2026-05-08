"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PackageSearch } from "lucide-react";
import { lookupsService } from "@/services/lookups-service";
import { getApiErrorMessage } from "@/services/api-client";
import { formatDate } from "@/services/utils";
import { useAuthStore } from "@/store/auth-store";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorPanel } from "@/components/shared/error-panel";
import { EmptyState } from "@/components/shared/empty-state";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function AssetsCatalog() {
  const activeBranchId = useAuthStore((state) => state.activeBranchId);
  const [search, setSearch] = useState("");

  const assetsQuery = useQuery({
    queryKey: ["assets", activeBranchId],
    queryFn: () => lookupsService.getAssets(activeBranchId),
  });

  const filteredAssets = useMemo(() => {
    if (!assetsQuery.data) {
      return [];
    }

    const term = search.trim().toLowerCase();
    if (!term) {
      return assetsQuery.data;
    }

    return assetsQuery.data.filter((asset) =>
      [asset.assetName, asset.assetCode, asset.clientName, asset.branchName, asset.assetType]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term)),
    );
  }, [assetsQuery.data, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assets"
        description="Browse the installed asset base with branch context, client ownership, and preventive-maintenance cues."
      />

      <Card className="rounded-[28px] p-4">
        <Input
          placeholder="Search by asset, code, client, type, or branch"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </Card>

      {assetsQuery.isError ? (
        <ErrorPanel message={getApiErrorMessage(assetsQuery.error, "We could not load assets right now.")} />
      ) : null}

      {assetsQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="soft-card h-48 animate-pulse rounded-[28px] bg-white/65" />
          ))}
        </div>
      ) : filteredAssets.length === 0 ? (
        <EmptyState
          title="No assets in this scope"
          description="When assets are available in the selected branch scope, they will show up here with maintenance-ready details."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {filteredAssets.map((asset) => (
            <Card key={asset.id} className="rounded-[28px] p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--tenant-primary)]/10 text-[color:var(--tenant-primary)]">
                  <PackageSearch className="h-6 w-6" />
                </div>
                <Badge tone={asset.status === "Active" ? "success" : "warning"}>{asset.status}</Badge>
              </div>
              <h3 className="display-font mt-4 text-2xl font-semibold text-slate-900">{asset.assetName}</h3>
              <p className="mt-1 text-sm font-medium text-slate-500">{asset.assetCode}</p>
              <div className="mt-4 grid gap-3 text-sm text-slate-600">
                <p><span className="font-semibold text-slate-800">Client:</span> {asset.clientName ?? "Unassigned client"}</p>
                <p><span className="font-semibold text-slate-800">Branch:</span> {asset.branchName ?? "Shared scope"}</p>
                <p><span className="font-semibold text-slate-800">Type:</span> {asset.assetType ?? "Not specified"}</p>
                <p><span className="font-semibold text-slate-800">Location:</span> {asset.location ?? "Not specified"}</p>
                <p><span className="font-semibold text-slate-800">Next PM:</span> {formatDate(asset.nextPmDate, "Not scheduled")}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
