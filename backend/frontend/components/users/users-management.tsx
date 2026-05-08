"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Plus, Shield, UserRoundCog } from "lucide-react";
import { toast } from "sonner";
import { usersService } from "@/services/users-service";
import { getApiErrorMessage } from "@/services/api-client";
import type { PermissionSet, UserSummary } from "@/services/types";
import { useAccess } from "@/hooks/use-access";
import { useAuthStore } from "@/store/auth-store";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorPanel } from "@/components/shared/error-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";

interface UserFormState {
  fullName: string;
  email: string;
  password: string;
  role: "Admin" | "User";
  jobTitle: string;
  department: string;
  isActive: boolean;
  hasAllBranchAccess: boolean;
  defaultBranchId: string;
  branchIds: string[];
  permissions: PermissionSet;
}

const defaultPermissions: PermissionSet = {
  canViewWorkOrders: true,
  canCreateWorkOrders: false,
  canAssignWorkOrders: false,
  canCompleteWorkOrders: false,
  canApproveMaterials: false,
  canIssueMaterials: false,
  canManageAssets: false,
  canManageSettings: false,
  canViewReports: false,
};

const initialUserForm: UserFormState = {
  fullName: "",
  email: "",
  password: "",
  role: "User",
  jobTitle: "",
  department: "",
  isActive: true,
  hasAllBranchAccess: false,
  defaultBranchId: "",
  branchIds: [],
  permissions: defaultPermissions,
};

export function UsersManagement() {
  const queryClient = useQueryClient();
  const access = useAccess();
  const branches = useAuthStore((state) => state.branches).filter((branch) => branch.isActive);
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [form, setForm] = useState<UserFormState>(initialUserForm);

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => usersService.getAll(),
    enabled: access.isAdmin,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        fullName: form.fullName,
        email: form.email,
        password: form.password || undefined,
        role: form.role,
        jobTitle: form.jobTitle || null,
        department: form.department || null,
        isActive: form.isActive,
        permissions: form.permissions,
        branchIds: form.role === "Admin" ? [] : form.branchIds,
        defaultBranchId: form.defaultBranchId || null,
        hasAllBranchAccess: form.role === "Admin" ? true : form.hasAllBranchAccess,
      };

      if (selectedUser) {
        return usersService.update(selectedUser.id, payload);
      }

      return usersService.create(payload);
    },
    onSuccess: () => {
      toast.success(selectedUser ? "User updated." : "User created.");
      setEditorOpen(false);
      setSelectedUser(null);
      setForm(initialUserForm);
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "We could not save that user.")),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => usersService.deactivate(id),
    onSuccess: () => {
      toast.success("User deactivated.");
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "We could not deactivate that user.")),
  });

  const filteredUsers = useMemo(() => {
    const list = usersQuery.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) {
      return list;
    }

    return list.filter((user) =>
      [user.fullName, user.email, user.role, user.jobTitle, user.department]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term)),
    );
  }, [search, usersQuery.data]);

  const openCreate = () => {
    setSelectedUser(null);
    setForm(initialUserForm);
    setEditorOpen(true);
  };

  const openEdit = (user: UserSummary) => {
    setSelectedUser(user);
    setForm({
      fullName: user.fullName,
      email: user.email,
      password: "",
      role: user.role === "Admin" ? "Admin" : "User",
      jobTitle: user.jobTitle ?? "",
      department: user.department ?? "",
      isActive: user.isActive,
      hasAllBranchAccess: user.hasAllBranchAccess,
      defaultBranchId: user.defaultBranchId ?? "",
      branchIds: user.branchIds,
      permissions: user.permissions,
    });
    setEditorOpen(true);
  };

  const toggleBranch = (branchId: string) => {
    setForm((current) => {
      const alreadyIncluded = current.branchIds.includes(branchId);
      const nextBranchIds = alreadyIncluded
        ? current.branchIds.filter((value) => value !== branchId)
        : [...current.branchIds, branchId];

      return {
        ...current,
        branchIds: nextBranchIds,
        defaultBranchId: nextBranchIds.includes(current.defaultBranchId) ? current.defaultBranchId : "",
      };
    });
  };

  if (!access.isAdmin) {
    return (
      <EmptyState
        title="Admin access required"
        description="Only tenant admins can create users, assign branches, or change permissions from this workspace."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Create tenant users, assign job roles, scope branch access, and tune operational permissions."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Create user
          </Button>
        }
      />

      <Card className="rounded-[28px] p-4">
        <Input placeholder="Search by name, email, role, or job title" value={search} onChange={(event) => setSearch(event.target.value)} />
      </Card>

      {usersQuery.isError ? <ErrorPanel message={getApiErrorMessage(usersQuery.error, "We could not load users.")} /> : null}

      {usersQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="soft-card h-60 animate-pulse rounded-[28px] bg-white/65" />
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <EmptyState title="No users yet" description="Create your first tenant user to start delegating work across branches." action={<Button onClick={openCreate}>Create user</Button>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {filteredUsers.map((user) => (
            <Card key={user.id} className="rounded-[28px] p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--tenant-primary)]/10 text-[color:var(--tenant-primary)]">
                  {user.role === "Admin" ? <Shield className="h-6 w-6" /> : <UserRoundCog className="h-6 w-6" />}
                </div>
                <Badge tone={user.isActive ? "success" : "warning"}>{user.isActive ? "Active" : "Inactive"}</Badge>
              </div>
              <h3 className="display-font mt-4 text-2xl font-semibold text-slate-900">{user.fullName}</h3>
              <p className="mt-1 text-sm text-slate-500">{user.email}</p>
              <div className="mt-4 grid gap-2 text-sm text-slate-600">
                <p><span className="font-semibold text-slate-800">Role:</span> {user.role}</p>
                <p><span className="font-semibold text-slate-800">Job title:</span> {user.jobTitle ?? "Not set"}</p>
                <p><span className="font-semibold text-slate-800">Branches:</span> {user.hasAllBranchAccess ? "All branches" : user.branchIds.length}</p>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" onClick={() => openEdit(user)}>Edit</Button>
                {user.isActive ? (
                  <Button size="sm" variant="danger" onClick={() => deactivateMutation.mutate(user.id)} disabled={deactivateMutation.isPending}>
                    Deactivate
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={selectedUser ? "Edit user" : "Create user"}
        description="Set role, branch assignments, and operational permissions in one place."
        className="max-w-5xl"
      >
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Full name</label>
                <Input value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Email</label>
                <Input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Password</label>
                <Input
                  type="password"
                  placeholder={selectedUser ? "Leave blank to keep current password" : "Temporary password"}
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Role</label>
                <Select
                  value={form.role}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      role: event.target.value as "Admin" | "User",
                      hasAllBranchAccess: event.target.value === "Admin" ? true : current.hasAllBranchAccess,
                    }))
                  }
                >
                  <option value="User">User</option>
                  <option value="Admin">Admin</option>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Job title</label>
                <Input value={form.jobTitle} onChange={(event) => setForm((current) => ({ ...current, jobTitle: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Department</label>
                <Input value={form.department} onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))} />
              </div>
            </div>

            <div className="grid gap-3">
              <Checkbox
                label="User is active"
                checked={form.isActive}
                onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
              />
              <Checkbox
                label="Allow access to all branches"
                description="Admins always receive full branch access. For regular users, this removes branch-level restrictions."
                checked={form.role === "Admin" ? true : form.hasAllBranchAccess}
                disabled={form.role === "Admin"}
                onChange={(event) => setForm((current) => ({ ...current, hasAllBranchAccess: event.target.checked }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Default branch</label>
              <Select value={form.defaultBranchId} onChange={(event) => setForm((current) => ({ ...current, defaultBranchId: event.target.value }))}>
                <option value="">Select default branch</option>
                {branches
                  .filter((branch) => form.role === "Admin" || form.hasAllBranchAccess || form.branchIds.includes(branch.id))
                  .map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.code} - {branch.name}
                    </option>
                  ))}
              </Select>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <p className="display-font text-xl font-semibold text-slate-900">Branch assignments</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">Pick the branches this user should operate inside when all-branch access is not enabled.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {branches.map((branch) => (
                  <Checkbox
                    key={branch.id}
                    label={`${branch.code} - ${branch.name}`}
                    description={branch.location ?? "Active branch"}
                    checked={form.role === "Admin" ? true : form.branchIds.includes(branch.id)}
                    disabled={form.role === "Admin"}
                    onChange={() => toggleBranch(branch.id)}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="display-font text-xl font-semibold text-slate-900">Permissions</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">Fine-tune what the user can do inside ServiceOps.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {Object.entries({
                  canViewWorkOrders: "View work orders",
                  canCreateWorkOrders: "Create work orders",
                  canAssignWorkOrders: "Assign work orders",
                  canCompleteWorkOrders: "Complete work orders",
                  canApproveMaterials: "Approve materials",
                  canIssueMaterials: "Issue materials",
                  canManageAssets: "Manage assets",
                  canManageSettings: "Manage settings",
                  canViewReports: "View reports",
                }).map(([key, label]) => (
                  <Checkbox
                    key={key}
                    label={label}
                    checked={form.role === "Admin" ? true : form.permissions[key as keyof PermissionSet]}
                    disabled={form.role === "Admin"}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        permissions: {
                          ...current.permissions,
                          [key]: event.target.checked,
                        },
                      }))
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setEditorOpen(false)}>Cancel</Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!form.fullName || !form.email || (!selectedUser && !form.password) || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              selectedUser ? "Save changes" : "Create user"
            )}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
