"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, LoaderCircle, Plus, UserPlus, Wrench } from "lucide-react";
import { toast } from "sonner";
import { useAccess } from "@/hooks/use-access";
import { lookupsService } from "@/services/lookups-service";
import { workOrdersService } from "@/services/workorders-service";
import { getApiErrorMessage } from "@/services/api-client";
import { formatDate, getPriorityTone, getStatusTone } from "@/services/utils";
import type { AssetSummary, ClientSummary, TechnicianSummary, WorkOrder } from "@/services/types";
import { useAuthStore } from "@/store/auth-store";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorPanel } from "@/components/shared/error-panel";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface WorkOrderFormState {
  clientId: string;
  assetId: string;
  branchId: string;
  title: string;
  description: string;
  priority: string;
  dueDate: string;
}

const initialFormState: WorkOrderFormState = {
  clientId: "",
  assetId: "",
  branchId: "",
  title: "",
  description: "",
  priority: "Medium",
  dueDate: "",
};

export function WorkOrdersBoard() {
  const queryClient = useQueryClient();
  const access = useAccess();
  const activeBranchId = useAuthStore((state) => state.activeBranchId);
  const branches = useAuthStore((state) => state.branches);
  const user = useAuthStore((state) => state.user);
  const setActiveBranchId = useAuthStore((state) => state.setActiveBranchId);
  const [statusFilter, setStatusFilter] = useState("");
  const [technicianFilter, setTechnicianFilter] = useState("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<WorkOrder | null>(null);
  const [assignTechnicianId, setAssignTechnicianId] = useState("");
  const [completeTarget, setCompleteTarget] = useState<WorkOrder | null>(null);
  const [workDoneNotes, setWorkDoneNotes] = useState("");
  const [viewTarget, setViewTarget] = useState<WorkOrder | null>(null);
  const [form, setForm] = useState<WorkOrderFormState>({
    ...initialFormState,
    branchId: activeBranchId ?? user?.defaultBranchId ?? "",
  });

  const workOrdersQuery = useQuery({
    queryKey: ["workorders", activeBranchId],
    queryFn: () => workOrdersService.getAll({ branchId: activeBranchId }),
  });

  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: () => lookupsService.getClients(),
  });

  const assetsQuery = useQuery({
    queryKey: ["assets", activeBranchId],
    queryFn: () => lookupsService.getAssets(activeBranchId),
  });

  const techniciansQuery = useQuery({
    queryKey: ["technicians", activeBranchId],
    queryFn: () => lookupsService.getTechnicians(activeBranchId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      workOrdersService.create({
        clientId: form.clientId,
        assetId: form.assetId || null,
        branchId: form.branchId || null,
        title: form.title,
        description: form.description || null,
        priority: form.priority,
        dueDate: form.dueDate || null,
        isPreventiveMaintenance: false,
      }),
    onSuccess: () => {
      toast.success("Work order created.");
      setCreateOpen(false);
      setForm({
        ...initialFormState,
        branchId: activeBranchId ?? user?.defaultBranchId ?? "",
      });
      void queryClient.invalidateQueries({ queryKey: ["workorders"] });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "We could not create the work order."));
    },
  });

  const assignMutation = useMutation({
    mutationFn: () => workOrdersService.assign(assignTarget!.id, { technicianId: assignTechnicianId }),
    onSuccess: () => {
      toast.success("Technician assigned.");
      setAssignTarget(null);
      setAssignTechnicianId("");
      void queryClient.invalidateQueries({ queryKey: ["workorders"] });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "We could not assign that technician."));
    },
  });

  const completeMutation = useMutation({
    mutationFn: () =>
      workOrdersService.complete(completeTarget!.id, {
        workDoneNotes,
        technicianId: completeTarget?.assignedTechnicianId ?? undefined,
      }),
    onSuccess: () => {
      toast.success("Work order completed.");
      setCompleteTarget(null);
      setWorkDoneNotes("");
      void queryClient.invalidateQueries({ queryKey: ["workorders"] });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "We could not complete that work order."));
    },
  });

  const filteredWorkOrders = useMemo(() => {
    const list = workOrdersQuery.data ?? [];
    const term = search.trim().toLowerCase();

    return list.filter((workOrder) => {
      const matchesStatus = !statusFilter || workOrder.status === statusFilter;
      const matchesTechnician = !technicianFilter || workOrder.assignedTechnicianId === technicianFilter;
      const matchesTerm =
        !term ||
        [workOrder.workOrderNumber, workOrder.title, workOrder.assetName, workOrder.clientName, workOrder.branchName]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(term));

      return matchesStatus && matchesTechnician && matchesTerm;
    });
  }, [search, statusFilter, technicianFilter, workOrdersQuery.data]);

  const clients = clientsQuery.data ?? [];
  const assets = assetsQuery.data ?? [];
  const technicians = techniciansQuery.data ?? [];

  const branchOptions = branches.filter((branch) => branch.isActive);

  const handleAssetChange = (assetId: string) => {
    const asset = assets.find((candidate) => candidate.id === assetId);

    setForm((current) => ({
      ...current,
      assetId,
      clientId: asset?.clientId ?? current.clientId,
      branchId: asset?.branchId ?? current.branchId,
      title: asset ? `Inspect ${asset.assetName}` : current.title,
    }));
  };

  const createDisabled = !form.clientId || !form.title.trim();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Work orders"
        description="Track, create, assign, and complete service work with branch visibility built into every list and action."
        action={
          access.canCreateWorkOrders ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Create work order
            </Button>
          ) : undefined
        }
      />

      <Card className="rounded-[28px] p-4">
        <div className="grid gap-3 xl:grid-cols-[1.2fr_0.85fr_0.85fr_0.85fr]">
          <Input placeholder="Search work orders" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Select value={activeBranchId ?? ""} onChange={(event) => setActiveBranchId(event.target.value || null)}>
            <option value="">{user?.role === "Admin" || user?.hasAllBranchAccess ? "All branches" : "All assigned branches"}</option>
            {branchOptions.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.code} - {branch.name}
              </option>
            ))}
          </Select>
          <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option>
            {["Open", "Assigned", "In Progress", "Pending Materials", "Completed", "Acknowledged", "Closed", "Cancelled"].map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
          <Select value={technicianFilter} onChange={(event) => setTechnicianFilter(event.target.value)}>
            <option value="">All technicians</option>
            {technicians.map((technician) => (
              <option key={technician.id} value={technician.id}>
                {technician.fullName}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {workOrdersQuery.isError ? (
        <ErrorPanel message={getApiErrorMessage(workOrdersQuery.error, "We could not load work orders.")} />
      ) : null}

      {workOrdersQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="soft-card h-24 animate-pulse rounded-[28px] bg-white/65" />
          ))}
        </div>
      ) : filteredWorkOrders.length === 0 ? (
        <EmptyState
          title="No work orders in this view"
          description="Create a work order or switch branch scope to see the jobs your team is currently handling."
          action={access.canCreateWorkOrders ? <Button onClick={() => setCreateOpen(true)}>Create work order</Button> : undefined}
        />
      ) : (
        <>
          <Card className="hidden overflow-hidden rounded-[28px] lg:block">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-900/4 text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Work Order Number</th>
                    <th className="px-5 py-4 font-semibold">Asset</th>
                    <th className="px-5 py-4 font-semibold">Branch</th>
                    <th className="px-5 py-4 font-semibold">Status</th>
                    <th className="px-5 py-4 font-semibold">Assigned To</th>
                    <th className="px-5 py-4 font-semibold">Created</th>
                    <th className="px-5 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWorkOrders.map((workOrder) => (
                    <tr key={workOrder.id} className="border-t border-slate-200/80">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">{workOrder.workOrderNumber}</p>
                        <p className="text-xs text-slate-500">{workOrder.title}</p>
                      </td>
                      <td className="px-5 py-4 text-slate-700">{workOrder.assetName ?? "General service task"}</td>
                      <td className="px-5 py-4 text-slate-700">{workOrder.branchName ?? "Shared scope"}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Badge tone={getStatusTone(workOrder.status)}>{workOrder.status}</Badge>
                          <Badge tone={getPriorityTone(workOrder.priority)}>{workOrder.priority}</Badge>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-700">{workOrder.assignedTechnicianName ?? "Unassigned"}</td>
                      <td className="px-5 py-4 text-slate-700">{formatDate(workOrder.createdAt)}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setViewTarget(workOrder)}>
                            <Eye className="h-4 w-4" />
                            View
                          </Button>
                          {access.canAssignWorkOrders ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setAssignTarget(workOrder);
                                setAssignTechnicianId(workOrder.assignedTechnicianId ?? "");
                              }}
                            >
                              <UserPlus className="h-4 w-4" />
                              Assign
                            </Button>
                          ) : null}
                          {access.canCompleteWorkOrders && workOrder.status !== "Completed" && workOrder.status !== "Acknowledged" ? (
                            <Button variant="secondary" size="sm" onClick={() => setCompleteTarget(workOrder)}>
                              <Wrench className="h-4 w-4" />
                              Complete
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-4 lg:hidden">
            {filteredWorkOrders.map((workOrder) => (
              <Card key={workOrder.id} className="rounded-[28px] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{workOrder.workOrderNumber}</p>
                    <p className="mt-1 text-sm text-slate-600">{workOrder.title}</p>
                  </div>
                  <Badge tone={getStatusTone(workOrder.status)}>{workOrder.status}</Badge>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-slate-600">
                  <p><span className="font-semibold text-slate-800">Asset:</span> {workOrder.assetName ?? "General service task"}</p>
                  <p><span className="font-semibold text-slate-800">Branch:</span> {workOrder.branchName ?? "Shared scope"}</p>
                  <p><span className="font-semibold text-slate-800">Assigned:</span> {workOrder.assignedTechnicianName ?? "Unassigned"}</p>
                  <p><span className="font-semibold text-slate-800">Created:</span> {formatDate(workOrder.createdAt)}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge tone={getPriorityTone(workOrder.priority)}>{workOrder.priority}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => setViewTarget(workOrder)}>View</Button>
                  {access.canAssignWorkOrders ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAssignTarget(workOrder);
                        setAssignTechnicianId(workOrder.assignedTechnicianId ?? "");
                      }}
                    >
                      Assign
                    </Button>
                  ) : null}
                  {access.canCompleteWorkOrders && workOrder.status !== "Completed" && workOrder.status !== "Acknowledged" ? (
                    <Button size="sm" variant="secondary" onClick={() => setCompleteTarget(workOrder)}>
                      Complete
                    </Button>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create work order"
        description="Capture the job, branch, asset, and priority so dispatch stays branch-aware from the start."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Client</label>
            <Select value={form.clientId} onChange={(event) => setForm((current) => ({ ...current, clientId: event.target.value }))}>
              <option value="">Select client</option>
              {clients.map((client: ClientSummary) => (
                <option key={client.id} value={client.id}>
                  {client.clientName}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Branch</label>
            <Select value={form.branchId} onChange={(event) => setForm((current) => ({ ...current, branchId: event.target.value }))}>
              <option value="">Use default branch scope</option>
              {branchOptions.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.code} - {branch.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Asset</label>
            <Select value={form.assetId} onChange={(event) => handleAssetChange(event.target.value)}>
              <option value="">General service task</option>
              {assets
                .filter((asset: AssetSummary) => !form.clientId || asset.clientId === form.clientId)
                .map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.assetCode} - {asset.assetName}
                  </option>
                ))}
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Priority</label>
            <Select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}>
              {["Low", "Medium", "High", "Critical"].map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-semibold text-slate-700">Title</label>
            <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Inspect chiller pressure drop" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-semibold text-slate-700">Description</label>
            <Textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Describe the issue, context, or work required."
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-semibold text-slate-700">Due date</label>
            <Input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} />
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setCreateOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => createMutation.mutate()} disabled={createDisabled || createMutation.isPending}>
            {createMutation.isPending ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create work order"
            )}
          </Button>
        </div>
      </Modal>

      <Modal
        open={Boolean(assignTarget)}
        onClose={() => setAssignTarget(null)}
        title="Assign technician"
        description="Keep the work order inside the correct branch and technician pool."
      >
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Technician</label>
          <Select value={assignTechnicianId} onChange={(event) => setAssignTechnicianId(event.target.value)}>
            <option value="">Select technician</option>
            {technicians.map((technician: TechnicianSummary) => (
              <option key={technician.id} value={technician.id}>
                {technician.fullName}
              </option>
            ))}
          </Select>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setAssignTarget(null)}>Cancel</Button>
          <Button onClick={() => assignMutation.mutate()} disabled={!assignTechnicianId || assignMutation.isPending}>
            {assignMutation.isPending ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              "Assign technician"
            )}
          </Button>
        </div>
      </Modal>

      <Modal
        open={Boolean(completeTarget)}
        onClose={() => setCompleteTarget(null)}
        title="Complete work order"
        description="Capture the work done notes before the job moves into a completed state."
      >
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Work done notes</label>
          <Textarea
            value={workDoneNotes}
            onChange={(event) => setWorkDoneNotes(event.target.value)}
            placeholder="Summarize the repair, inspection, or closure details."
          />
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setCompleteTarget(null)}>Cancel</Button>
          <Button
            variant="secondary"
            onClick={() => completeMutation.mutate()}
            disabled={!workDoneNotes.trim() || completeMutation.isPending}
          >
            {completeMutation.isPending ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Completing...
              </>
            ) : (
              "Mark complete"
            )}
          </Button>
        </div>
      </Modal>

      <Modal
        open={Boolean(viewTarget)}
        onClose={() => setViewTarget(null)}
        title={viewTarget?.workOrderNumber ?? "Work order details"}
        description={viewTarget?.title}
      >
        {viewTarget ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="rounded-[24px] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Status</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone={getStatusTone(viewTarget.status)}>{viewTarget.status}</Badge>
                <Badge tone={getPriorityTone(viewTarget.priority)}>{viewTarget.priority}</Badge>
              </div>
            </Card>
            <Card className="rounded-[24px] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Assigned technician</p>
              <p className="mt-3 text-base font-semibold text-slate-900">{viewTarget.assignedTechnicianName ?? "Unassigned"}</p>
            </Card>
            <Card className="rounded-[24px] p-4 md:col-span-2">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Description</p>
              <p className="mt-3 text-sm leading-7 text-slate-700">{viewTarget.description ?? "No description provided."}</p>
            </Card>
            <Card className="rounded-[24px] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Asset</p>
              <p className="mt-3 text-base font-semibold text-slate-900">{viewTarget.assetName ?? "General service task"}</p>
            </Card>
            <Card className="rounded-[24px] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Branch</p>
              <p className="mt-3 text-base font-semibold text-slate-900">{viewTarget.branchName ?? "Shared scope"}</p>
            </Card>
            <Card className="rounded-[24px] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Created</p>
              <p className="mt-3 text-base font-semibold text-slate-900">{formatDate(viewTarget.createdAt)}</p>
            </Card>
            <Card className="rounded-[24px] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Due date</p>
              <p className="mt-3 text-base font-semibold text-slate-900">{formatDate(viewTarget.dueDate, "Not set")}</p>
            </Card>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
