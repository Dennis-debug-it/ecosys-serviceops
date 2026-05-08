"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, LoaderCircle, PackagePlus, SlidersHorizontal, Warehouse } from "lucide-react";
import { toast } from "sonner";
import { useAccess } from "@/hooks/use-access";
import { materialsService } from "@/services/materials-service";
import { getApiErrorMessage } from "@/services/api-client";
import { formatCurrency, formatDateTime, formatNumber } from "@/services/utils";
import type { MaterialItem, StockMovement } from "@/services/types";
import { useAuthStore } from "@/store/auth-store";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorPanel } from "@/components/shared/error-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface MaterialFormState {
  itemCode: string;
  itemName: string;
  category: string;
  unitOfMeasure: string;
  quantityOnHand: string;
  reorderLevel: string;
  unitCost: string;
  branchId: string;
}

const initialMaterialForm: MaterialFormState = {
  itemCode: "",
  itemName: "",
  category: "",
  unitOfMeasure: "",
  quantityOnHand: "0",
  reorderLevel: "0",
  unitCost: "",
  branchId: "",
};

export function MaterialsHub() {
  const queryClient = useQueryClient();
  const access = useAccess();
  const activeBranchId = useAuthStore((state) => state.activeBranchId);
  const branches = useAuthStore((state) => state.branches);
  const user = useAuthStore((state) => state.user);
  const setActiveBranchId = useAuthStore((state) => state.setActiveBranchId);
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<MaterialFormState>({
    ...initialMaterialForm,
    branchId: activeBranchId ?? user?.defaultBranchId ?? "",
  });
  const [replenishTarget, setReplenishTarget] = useState<MaterialItem | null>(null);
  const [replenishForm, setReplenishForm] = useState({ branchId: activeBranchId ?? user?.defaultBranchId ?? "", quantity: "0", unitCost: "", reason: "", referenceNumber: "" });
  const [adjustTarget, setAdjustTarget] = useState<MaterialItem | null>(null);
  const [adjustForm, setAdjustForm] = useState({ branchId: activeBranchId ?? user?.defaultBranchId ?? "", quantityChange: "0", reason: "" });
  const [movementTarget, setMovementTarget] = useState<MaterialItem | null>(null);

  const materialsQuery = useQuery({
    queryKey: ["materials", activeBranchId, lowStockOnly],
    queryFn: () => materialsService.getAll({ branchId: activeBranchId, lowStockOnly }),
  });

  const movementsQuery = useQuery({
    queryKey: ["material-movements", movementTarget?.id, activeBranchId],
    queryFn: () => materialsService.getMovements(movementTarget!.id, activeBranchId),
    enabled: Boolean(movementTarget),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      materialsService.create({
        itemCode: createForm.itemCode,
        itemName: createForm.itemName,
        category: createForm.category || null,
        unitOfMeasure: createForm.unitOfMeasure,
        quantityOnHand: Number(createForm.quantityOnHand || 0),
        reorderLevel: Number(createForm.reorderLevel || 0),
        unitCost: createForm.unitCost ? Number(createForm.unitCost) : null,
        branchId: createForm.branchId || null,
      }),
    onSuccess: () => {
      toast.success("Material created.");
      setCreateOpen(false);
      setCreateForm({
        ...initialMaterialForm,
        branchId: activeBranchId ?? user?.defaultBranchId ?? "",
      });
      void queryClient.invalidateQueries({ queryKey: ["materials"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "We could not create that material item.")),
  });

  const replenishMutation = useMutation({
    mutationFn: () =>
      materialsService.replenish(replenishTarget!.id, {
        branchId: replenishForm.branchId || null,
        quantity: Number(replenishForm.quantity || 0),
        unitCost: replenishForm.unitCost ? Number(replenishForm.unitCost) : null,
        reason: replenishForm.reason || null,
        referenceNumber: replenishForm.referenceNumber || null,
      }),
    onSuccess: () => {
      toast.success("Stock replenished.");
      setReplenishTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["materials"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "We could not replenish stock.")),
  });

  const adjustMutation = useMutation({
    mutationFn: () =>
      materialsService.adjust(adjustTarget!.id, {
        branchId: adjustForm.branchId || null,
        quantityChange: Number(adjustForm.quantityChange || 0),
        reason: adjustForm.reason || null,
      }),
    onSuccess: () => {
      toast.success("Stock adjusted.");
      setAdjustTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["materials"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "We could not adjust stock.")),
  });

  const filteredMaterials = useMemo(() => {
    const list = materialsQuery.data ?? [];
    const term = search.trim().toLowerCase();

    if (!term) {
      return list;
    }

    return list.filter((material) =>
      [material.itemCode, material.itemName, material.category, material.branchName]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term)),
    );
  }, [materialsQuery.data, search]);

  const branchOptions = branches.filter((branch) => branch.isActive);
  const canSeeAllBranches = user?.role === "Admin" || user?.hasAllBranchAccess;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Materials and stores"
        description="Track branch stock positions, replenish inventory, correct counts, and audit recent stock movement."
        action={
          access.canIssueMaterials ? (
            <Button onClick={() => setCreateOpen(true)}>
              <PackagePlus className="h-4 w-4" />
              Add material
            </Button>
          ) : undefined
        }
      />

      <Card className="rounded-[28px] p-4">
        <div className="grid gap-3 xl:grid-cols-[1.2fr_0.85fr_0.7fr]">
          <Input placeholder="Search materials" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Select value={activeBranchId ?? ""} onChange={(event) => setActiveBranchId(event.target.value || null)}>
            <option value="">{canSeeAllBranches ? "All branches" : "All assigned branches"}</option>
            {branchOptions.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.code} - {branch.name}
              </option>
            ))}
          </Select>
          <Button variant={lowStockOnly ? "secondary" : "ghost"} onClick={() => setLowStockOnly((value) => !value)}>
            <SlidersHorizontal className="h-4 w-4" />
            {lowStockOnly ? "Showing low stock" : "Filter low stock"}
          </Button>
        </div>
      </Card>

      {materialsQuery.isError ? (
        <ErrorPanel message={getApiErrorMessage(materialsQuery.error, "We could not load materials.")} />
      ) : null}

      {materialsQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="soft-card h-52 animate-pulse rounded-[28px] bg-white/65" />
          ))}
        </div>
      ) : filteredMaterials.length === 0 ? (
        <EmptyState
          title="No materials found"
          description="Create a material item or widen the branch scope to view stock positions across your tenant."
          action={access.canIssueMaterials ? <Button onClick={() => setCreateOpen(true)}>Add material</Button> : undefined}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {filteredMaterials.map((material) => (
            <Card key={material.id} className="rounded-[28px] p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--tenant-primary)]/10 text-[color:var(--tenant-primary)]">
                  <Warehouse className="h-6 w-6" />
                </div>
                <Badge tone={material.isLowStock ? "warning" : "success"}>
                  {material.isLowStock ? "Low stock" : "Healthy"}
                </Badge>
              </div>
              <h3 className="display-font mt-4 text-2xl font-semibold text-slate-900">{material.itemName}</h3>
              <p className="mt-1 text-sm font-medium text-slate-500">{material.itemCode}</p>
              <div className="mt-4 grid gap-3 text-sm text-slate-600">
                <p><span className="font-semibold text-slate-800">Branch:</span> {material.branchName ?? (activeBranchId ? "Selected branch" : "Current scope total")}</p>
                <p><span className="font-semibold text-slate-800">Quantity:</span> {formatNumber(material.quantityOnHand, 2)} {material.unitOfMeasure}</p>
                <p><span className="font-semibold text-slate-800">Reorder level:</span> {formatNumber(material.reorderLevel, 2)} {material.unitOfMeasure}</p>
                <p><span className="font-semibold text-slate-800">Unit cost:</span> {formatCurrency(material.unitCost)}</p>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {access.canIssueMaterials ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => {
                        setReplenishTarget(material);
                        setReplenishForm({
                          branchId: activeBranchId ?? user?.defaultBranchId ?? material.branchId ?? "",
                          quantity: "0",
                          unitCost: material.unitCost?.toString() ?? "",
                          reason: "",
                          referenceNumber: "",
                        });
                      }}
                    >
                      Replenish
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setAdjustTarget(material);
                        setAdjustForm({
                          branchId: activeBranchId ?? user?.defaultBranchId ?? material.branchId ?? "",
                          quantityChange: "0",
                          reason: "",
                        });
                      }}
                    >
                      Adjust
                    </Button>
                  </>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => setMovementTarget(material)}>
                  <History className="h-4 w-4" />
                  Movements
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add material" description="Create a catalog item and optionally seed opening stock in a branch.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Item code</label>
            <Input value={createForm.itemCode} onChange={(event) => setCreateForm((current) => ({ ...current, itemCode: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Item name</label>
            <Input value={createForm.itemName} onChange={(event) => setCreateForm((current) => ({ ...current, itemName: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Category</label>
            <Input value={createForm.category} onChange={(event) => setCreateForm((current) => ({ ...current, category: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Unit of measure</label>
            <Input value={createForm.unitOfMeasure} onChange={(event) => setCreateForm((current) => ({ ...current, unitOfMeasure: event.target.value }))} placeholder="PCS, L, KG" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Opening quantity</label>
            <Input type="number" min="0" step="0.01" value={createForm.quantityOnHand} onChange={(event) => setCreateForm((current) => ({ ...current, quantityOnHand: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Reorder level</label>
            <Input type="number" min="0" step="0.01" value={createForm.reorderLevel} onChange={(event) => setCreateForm((current) => ({ ...current, reorderLevel: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Unit cost</label>
            <Input type="number" min="0" step="0.01" value={createForm.unitCost} onChange={(event) => setCreateForm((current) => ({ ...current, unitCost: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Branch</label>
            <Select value={createForm.branchId} onChange={(event) => setCreateForm((current) => ({ ...current, branchId: event.target.value }))}>
              <option value="">Use default branch scope</option>
              {branchOptions.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.code} - {branch.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!createForm.itemCode || !createForm.itemName || !createForm.unitOfMeasure || createMutation.isPending}
          >
            {createMutation.isPending ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Create material"
            )}
          </Button>
        </div>
      </Modal>

      <Modal open={Boolean(replenishTarget)} onClose={() => setReplenishTarget(null)} title="Replenish stock" description="Record stock received into the selected branch.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Branch</label>
            <Select value={replenishForm.branchId} onChange={(event) => setReplenishForm((current) => ({ ...current, branchId: event.target.value }))}>
              <option value="">Select branch</option>
              {branchOptions.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.code} - {branch.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Quantity</label>
            <Input type="number" min="0" step="0.01" value={replenishForm.quantity} onChange={(event) => setReplenishForm((current) => ({ ...current, quantity: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Unit cost</label>
            <Input type="number" min="0" step="0.01" value={replenishForm.unitCost} onChange={(event) => setReplenishForm((current) => ({ ...current, unitCost: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Reference number</label>
            <Input value={replenishForm.referenceNumber} onChange={(event) => setReplenishForm((current) => ({ ...current, referenceNumber: event.target.value }))} placeholder="DN-001" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-semibold text-slate-700">Reason</label>
            <Textarea value={replenishForm.reason} onChange={(event) => setReplenishForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Supplier delivery" />
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setReplenishTarget(null)}>Cancel</Button>
          <Button onClick={() => replenishMutation.mutate()} disabled={!replenishForm.branchId || Number(replenishForm.quantity) <= 0 || replenishMutation.isPending}>
            {replenishMutation.isPending ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Posting...
              </>
            ) : (
              "Replenish stock"
            )}
          </Button>
        </div>
      </Modal>

      <Modal open={Boolean(adjustTarget)} onClose={() => setAdjustTarget(null)} title="Adjust stock" description="Correct inventory levels for the selected branch.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Branch</label>
            <Select value={adjustForm.branchId} onChange={(event) => setAdjustForm((current) => ({ ...current, branchId: event.target.value }))}>
              <option value="">Select branch</option>
              {branchOptions.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.code} - {branch.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Quantity change</label>
            <Input type="number" step="0.01" value={adjustForm.quantityChange} onChange={(event) => setAdjustForm((current) => ({ ...current, quantityChange: event.target.value }))} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-semibold text-slate-700">Reason</label>
            <Textarea value={adjustForm.reason} onChange={(event) => setAdjustForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Stock count correction" />
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setAdjustTarget(null)}>Cancel</Button>
          <Button variant="secondary" onClick={() => adjustMutation.mutate()} disabled={!adjustForm.branchId || Number(adjustForm.quantityChange) === 0 || adjustMutation.isPending}>
            {adjustMutation.isPending ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Adjust stock"
            )}
          </Button>
        </div>
      </Modal>

      <Modal open={Boolean(movementTarget)} onClose={() => setMovementTarget(null)} title={movementTarget ? `${movementTarget.itemName} movements` : "Stock movements"} description="Recent stock ledger entries in the current branch scope.">
        {movementsQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="soft-card h-20 animate-pulse rounded-[24px] bg-white/65" />
            ))}
          </div>
        ) : movementsQuery.isError ? (
          <ErrorPanel message={getApiErrorMessage(movementsQuery.error, "We could not load stock movements.")} />
        ) : (movementsQuery.data ?? []).length === 0 ? (
          <EmptyState title="No stock movements yet" description="Movements will appear here after replenishments, issues, returns, or adjustments are posted." />
        ) : (
          <div className="space-y-3">
            {(movementsQuery.data ?? []).map((movement: StockMovement) => (
              <Card key={movement.id} className="rounded-[24px] p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{movement.movementType}</p>
                    <p className="mt-1 text-sm text-slate-600">{movement.reason ?? "No reason provided"}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {movement.branchName ?? "Current scope"} • {formatDateTime(movement.createdAt)}
                    </p>
                  </div>
                  <div className="text-sm text-slate-600 md:text-right">
                    <p><span className="font-semibold text-slate-900">Qty:</span> {formatNumber(movement.quantity, 2)}</p>
                    <p><span className="font-semibold text-slate-900">Balance:</span> {formatNumber(movement.balanceAfter, 2)}</p>
                    <p><span className="font-semibold text-slate-900">Ref:</span> {movement.referenceNumber ?? "N/A"}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
